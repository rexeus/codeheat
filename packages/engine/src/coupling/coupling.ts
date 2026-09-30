// Owns change coupling: which pairs of files repeatedly change in the same commits.
import { Order } from "effect";

import { roundReported } from "../report/precision.js";
import type { Coupling } from "../report/report.js";
import { directoryDistance, isTestPair } from "./pair.js";

/** Commits touching more files than this say nothing about coupling. */
export const MAX_COMMIT_FILES = 50;
export const MIN_SHARED_COMMITS = 3;
export const MIN_DEGREE = 0.3;

const byStrength = (a: Coupling, b: Coupling): number =>
  b.degree - a.degree ||
  b.sharedCommits - a.sharedCommits ||
  Order.String(a.a, b.a) ||
  Order.String(a.b, b.b);

const countPairs = (
  commit: Uint32Array,
  fileCount: number,
  shared: Map<number, number>,
): void => {
  for (const low of commit) {
    for (const high of commit) {
      if (low < high) {
        const pair = low * fileCount + high;
        shared.set(pair, (shared.get(pair) ?? 0) + 1);
      }
    }
  }
};

/**
 * Counts the commits each pair of file ids shares, keyed `low * fileCount + high`.
 * Ids within one commit are distinct.
 */
const countSharedCommits = (
  commits: ReadonlyArray<Uint32Array>,
  fileCount: number,
): ReadonlyMap<number, number> => {
  const shared = new Map<number, number>();
  for (const commit of commits) {
    countPairs(commit, fileCount, shared);
  }
  return shared;
};

/**
 * Finds the coupled pairs among `commits`, each the distinct ids of the files
 * one commit touched; an id is an index into `paths`. `revisions` counts every
 * commit per path, including the ones ignored here for being too large.
 *
 * `couplingCommits` is the number of commits small enough to count. Pairs
 * are sorted by their reported (rounded) degree, then shared commits, then path.
 */
export const findCouplings = (
  commits: ReadonlyArray<Uint32Array>,
  paths: ReadonlyArray<string>,
  revisions: ReadonlyMap<string, number>,
): {
  readonly couplingCommits: number;
  readonly couplings: ReadonlyArray<Coupling>;
} => {
  const counted = commits.filter((commit) => commit.length <= MAX_COMMIT_FILES);
  const revisionsById = paths.map((path) => revisions.get(path) ?? 0);
  const couplings: Array<Coupling> = [];
  for (const [pair, sharedCommits] of countSharedCommits(
    counted,
    paths.length,
  )) {
    const high = pair % paths.length;
    const low = (pair - high) / paths.length;
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
      });
    }
  }
  return {
    couplingCommits: counted.length,
    couplings: couplings.toSorted(byStrength),
  };
};
