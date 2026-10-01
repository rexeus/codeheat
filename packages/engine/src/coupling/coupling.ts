// Owns change coupling: which pairs of files repeatedly change in the same commits.
import { Order } from "effect";

import type { HistoryCommit } from "../history/history.js";
import type { ModuleRef } from "../modules/detect.js";
import { roundReported } from "../report/precision.js";
import type { Coupling } from "../report/report.js";
import { directoryDistance, isTestPair } from "./pair.js";

/** Commits touching more files than this say nothing about coupling. */
export const MAX_COMMIT_FILES = 50;
export const MIN_SHARED_COMMITS = 3;
export const MIN_DEGREE = 0.3;

/**
 * The commits small enough to say something about coupling, modules, and
 * interfaces: those that touched at most `MAX_COMMIT_FILES` universe files,
 * counting files that are dead today (see `HistoryCommit.size`).
 */
export const countedCommits = (
  commits: ReadonlyArray<HistoryCommit>,
): ReadonlyArray<HistoryCommit> =>
  commits.filter((commit) => commit.size <= MAX_COMMIT_FILES);

const byStrength = (a: Coupling, b: Coupling): number =>
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
  commits: ReadonlyArray<HistoryCommit>,
): SharedCommits => {
  const shared: SharedCommits = new Map();
  for (const commit of commits) {
    countPairs(commit.files, shared);
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

/** The couplings of one window with what was learned counting them. */
export type Couplings = {
  readonly couplingCommits: number;
  readonly couplings: ReadonlyArray<Coupling>;
  readonly breadth: ReadonlyMap<string, number>;
};

/**
 * Finds the coupled pairs among `commits`, each listing the distinct ids of
 * the files one commit touched; an id is an index into `paths`. `revisions` counts every
 * commit per path, including the ones ignored here for being too large.
 *
 * Every coupling comes back with `imports: null`; the import graph fills it in.
 * `couplingCommits` is the number of commits small enough to count. Pairs
 * are sorted by their reported (rounded) degree, then shared commits, then path.
 * `breadth` maps every path in `paths` to the number of distinct other files it
 * shares a counted commit with, whatever the pair's strength. `modules` maps
 * every path to its module and decides `crossesModule`.
 */
export const findCouplings = (
  commits: ReadonlyArray<HistoryCommit>,
  paths: ReadonlyArray<string>,
  revisions: ReadonlyMap<string, number>,
  modules: ReadonlyMap<string, ModuleRef>,
): Couplings => {
  const counted = countedCommits(commits);
  const revisionsById = paths.map((path) => revisions.get(path) ?? 0);
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
      const meanRevisions =
        ((revisionsById[low] ?? 0) + (revisionsById[high] ?? 0)) / 2;
      const degree = sharedCommits / meanRevisions;
      if (sharedCommits >= MIN_SHARED_COMMITS && degree >= MIN_DEGREE) {
        couplings.push({
          a,
          b,
          sharedCommits,
          degree: roundReported(degree),
          distance: directoryDistance(a, b),
          testPair: isTestPair(a, b),
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
