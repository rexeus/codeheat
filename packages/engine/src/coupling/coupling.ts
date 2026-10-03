// Owns change coupling: which pairs of files repeatedly change in the same commits.
import { Order } from "effect";

import type { LogicalChange } from "../changes/logical-change.js";
import { shrunkShare } from "../history/recency.js";
import type { ModuleRef } from "../modules/detect.js";
import type { FileKind } from "../report/contract-file.js";
import { roundReported } from "../report/precision.js";
import type { Coupling } from "../report/report.js";
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
 * A number per pair of file ids, nested as `low -> high -> number`.
 * One map over all pairs would hit V8's limit of about 16.7M entries on a
 * large repository; every inner map stays far below it.
 */
type SharedCommits = Map<number, Map<number, number>>;

/** What the changes of each pair of file ids add up to, in the shape of `SharedCommits`. */
type Shared = {
  /** How many changes each pair shares. */
  readonly commits: SharedCommits;
  /** The sum of the weights of those changes. */
  readonly weights: SharedCommits;
};

const addTo = (
  shared: SharedCommits,
  low: number,
  high: number,
  amount: number,
): void => {
  const partners = shared.get(low) ?? new Map<number, number>();
  partners.set(high, (partners.get(high) ?? 0) + amount);
  shared.set(low, partners);
};

const countPairs = ({ files, weight }: LogicalChange, shared: Shared): void => {
  for (const low of files) {
    for (const high of files) {
      if (low < high) {
        addTo(shared.commits, low, high, 1);
        addTo(shared.weights, low, high, weight);
      }
    }
  }
};

/** Counts, and sums the weights of, the changes each pair of file ids shares. Ids within one change are distinct. */
const countSharedCommits = (changes: ReadonlyArray<LogicalChange>): Shared => {
  const shared: Shared = { commits: new Map(), weights: new Map() };
  for (const change of changes) {
    countPairs(change, shared);
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

const byPath = (one: string, other: string): readonly [string, string] =>
  Order.String(one, other) <= 0 ? [one, other] : [other, one];

/** A file's changes in a window: how many, and what they weigh. */
type Changes = {
  readonly changes: number;
  readonly weightedChanges: number;
};

const meanOf = (one: number, other: number): number => (one + other) / 2;

/**
 * The weight of the changes two files share over the mean of their weighted
 * changes, shrunk towards the plain degree (see `shrunkShare`). The shared
 * weight is part of both files' weighted changes; the minimum absorbs float
 * error in the sums.
 */
const degreeOf = (
  sharedCommits: number,
  sharedWeight: number,
  one: Changes,
  other: Changes,
): number =>
  Math.min(
    1,
    shrunkShare(
      { plain: sharedCommits, weighted: sharedWeight },
      {
        plain: meanOf(one.changes, other.changes),
        weighted: meanOf(one.weightedChanges, other.weightedChanges),
      },
    ),
  );

const couplingOf = (
  [a, b]: readonly [string, string],
  sharedCommits: number,
  degree: number,
  { modules, contracts }: Places,
): Coupling => ({
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

/** The couplings of one window with what was learned counting them. */
export type Couplings = {
  readonly couplingCommits: number;
  readonly couplings: ReadonlyArray<Coupling>;
  readonly breadth: ReadonlyMap<string, number>;
};

/**
 * Finds the coupled pairs among `changes`, each listing the distinct ids of
 * the files one change touched; an id is an index into `paths`. `changes`
 * counts every logical change per path and sums their weights
 * (`LogicalChange.weight`), including the ones ignored here for being too large.
 *
 * A pair's `degree` is the weight of the changes it shares over the mean
 * weighted changes of its files, so recent shared changes count more than old
 * ones, shrunk towards the plain degree (see `shrunkShare`) so a few recent
 * changes of one file do not collapse a pair built on many old shared ones;
 * `sharedCommits` stays a plain count, and `MIN_SHARED_COMMITS` gates on it, so
 * a pair is never dropped for being old alone.
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
  perFile: ReadonlyMap<string, Changes>,
  places: Places,
): Couplings => {
  const counted = countedChanges(changes);
  const none: Changes = { changes: 0, weightedChanges: 0 };
  const changesById = paths.map((path) => perFile.get(path) ?? none);
  const couplings: Array<Coupling> = [];
  const shared = countSharedCommits(counted);
  for (const [low, partners] of shared.commits) {
    for (const [high, sharedCommits] of partners) {
      const pair = byPath(paths[low] ?? "", paths[high] ?? "");
      const degree = degreeOf(
        sharedCommits,
        shared.weights.get(low)?.get(high) ?? 0,
        changesById[low] ?? none,
        changesById[high] ?? none,
      );
      if (sharedCommits >= MIN_SHARED_COMMITS && degree >= MIN_DEGREE) {
        couplings.push(couplingOf(pair, sharedCommits, degree, places));
      }
    }
  }
  return {
    couplingCommits: counted.length,
    couplings: couplings.toSorted(byStrength),
    breadth: new Map(
      breadthById(shared.commits, paths.length).map((count, id) => [
        paths[id] ?? "",
        count,
      ]),
    ),
  };
};
