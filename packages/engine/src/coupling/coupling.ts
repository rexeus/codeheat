// Owns change coupling: which pairs of files repeatedly change in the same commits.
import { Order } from "effect";

import type { LogicalChange } from "../changes/logical-change.js";
import type { Coupling } from "../model/analysis.js";
import type { FileKind } from "../model/contract-file.js";
import { roundReported } from "../model/precision.js";
import type { ModuleRef } from "../modules/detect.js";
import { directoryDistance, isTestPair } from "./pair.js";

/** Commits touching more files than this say nothing about coupling. */
export const MAX_COMMIT_FILES = 50;
export const MIN_SHARED_COMMITS = 3;
export const MIN_DEGREE = 0.3;

/**
 * The changes that say something about coupling, modules, and interfaces:
 * those that touched at most `MAX_COMMIT_FILES` universe files, counting files
 * that are dead today (see `LogicalChange.size`).
 */
export const countedChanges = (
  changes: ReadonlyArray<LogicalChange>,
): ReadonlyArray<LogicalChange> =>
  changes.filter((change) => change.size <= MAX_COMMIT_FILES);

const kindOf = (path: string, contracts: ReadonlySet<string>): FileKind =>
  contracts.has(path) ? "contract" : "code";

const isContractPair = ({ kinds }: Coupling): boolean =>
  kinds.a === "contract" && kinds.b === "contract";

/**
 * Pairs with a code side first, contract pairs after them: the files of one
 * API definition change together far more often than any two pieces of code,
 * and would fill every limited list. Within each group, by degree, shared
 * commits, then path.
 */
const byStrength = (a: Coupling, b: Coupling): number =>
  Number(isContractPair(a)) - Number(isContractPair(b)) ||
  b.degree - a.degree ||
  b.sharedCommits - a.sharedCommits ||
  Order.String(a.a, b.a) ||
  Order.String(a.b, b.b);

/**
 * Shared commits per pair of file ids, nested as `low -> high -> count`.
 * One map over all pairs would hit V8's limit of about 16.7M entries on a
 * large repository; every inner map stays far below it.
 */
type SharedCommits = Map<number, Map<number, number>>;

const countPairs = (commit: Uint32Array, shared: SharedCommits): void => {
  for (const low of commit) {
    for (const high of commit) {
      if (low < high) {
        const partners = shared.get(low) ?? new Map<number, number>();
        partners.set(high, (partners.get(high) ?? 0) + 1);
        shared.set(low, partners);
      }
    }
  }
};

/** Counts the commits each pair of file ids shares. Ids within one commit are distinct. */
const countSharedCommits = (
  changes: ReadonlyArray<LogicalChange>,
): SharedCommits => {
  const shared: SharedCommits = new Map();
  for (const change of changes) {
    countPairs(change.files, shared);
  }
  return shared;
};

/** Counts, per file id, the distinct files it shares at least one commit with. */
const breadthById = (
  shared: SharedCommits,
  fileCount: number,
): ReadonlyArray<number> => {
  const breadth = Array.from({ length: fileCount }, () => 0);
  for (const [low, partners] of shared) {
    breadth[low] = (breadth[low] ?? 0) + partners.size;
    for (const high of partners.keys()) {
      breadth[high] = (breadth[high] ?? 0) + 1;
    }
  }
  return breadth;
};

/** Where the files of a window live and which of them are contracts. */
export type Places = {
  /** The module of every path, contract files included. */
  readonly modules: ReadonlyMap<string, ModuleRef>;
  /** The paths that are contract files. */
  readonly contracts: ReadonlySet<string>;
};

/** The couplings of one window with what was learned counting them. */
export type Couplings = {
  readonly couplingCommits: number;
  readonly couplings: ReadonlyArray<Coupling>;
  readonly breadth: ReadonlyMap<string, number>;
};

/**
 * Finds the coupled pairs among `changes`, each listing the distinct ids of
 * the files one change touched; an id is an index into `paths`. `changesPerFile` counts the
 * counted changes per path (see `countedChanges`), the same changes the pairs share.
 *
 * Every coupling comes back with `imports: null`; the import graph fills it in.
 * `couplingCommits` is the number of changes small enough to count. Pairs
 * with a code side come before pairs of two contract files, each group sorted
 * by its reported (rounded) degree, then shared commits, then path.
 * `breadth` maps every path in `paths` to the number of distinct other files it
 * shares a counted commit with, whatever the pair's strength. `places` says
 * where every path lives, which decides `crossesModule`, and which paths are
 * contract files, which `kinds` tells apart from code.
 */
export const findCouplings = (
  changes: ReadonlyArray<LogicalChange>,
  paths: ReadonlyArray<string>,
  changesPerFile: ReadonlyMap<string, number>,
  places: Places,
): Couplings => {
  const { modules, contracts } = places;
  const counted = countedChanges(changes);
  const changesById = paths.map((path) => changesPerFile.get(path) ?? 0);
  const couplings: Array<Coupling> = [];
  const shared = countSharedCommits(counted);
  for (const [low, partners] of shared) {
    for (const [high, sharedCommits] of partners) {
      const lowPath = paths[low] ?? "";
      const highPath = paths[high] ?? "";
      const [a, b] =
        Order.String(lowPath, highPath) <= 0
          ? [lowPath, highPath]
          : [highPath, lowPath];
      const meanChanges =
        ((changesById[low] ?? 0) + (changesById[high] ?? 0)) / 2;
      const degree = sharedCommits / meanChanges;
      if (sharedCommits >= MIN_SHARED_COMMITS && degree >= MIN_DEGREE) {
        couplings.push({
          a,
          b,
          sharedCommits,
          degree: roundReported(degree),
          distance: directoryDistance(a, b),
          testPair: isTestPair(a, b),
          kinds: { a: kindOf(a, contracts), b: kindOf(b, contracts) },
          crossesModule: modules.get(a)?.path !== modules.get(b)?.path,
          imports: null,
        });
      }
    }
  }
  return {
    couplingCommits: counted.length,
    couplings: couplings.toSorted(byStrength),
    breadth: new Map(
      breadthById(shared, paths.length).map((count, id) => [
        paths[id] ?? "",
        count,
      ]),
    ),
  };
};
