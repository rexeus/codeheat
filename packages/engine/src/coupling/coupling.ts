// Owns change coupling: which pairs of files repeatedly change in the same commits.
import { Order } from "effect";

import type { Coupling } from "../report/report.js";
import { directoryDistance, isTestPair } from "./pair.js";

/** Commits touching more files than this say nothing about coupling. */
export const MAX_COMMIT_FILES = 50;
export const MIN_SHARED_COMMITS = 3;
export const MIN_DEGREE = 0.3;

const PAIR_SEPARATOR = "\0";

const byStrength = (a: Coupling, b: Coupling): number =>
  b.degree - a.degree ||
  b.sharedCommits - a.sharedCommits ||
  Order.String(a.a, b.a) ||
  Order.String(a.b, b.b);

const countSharedCommits = (
  commits: ReadonlyArray<ReadonlyArray<string>>,
): ReadonlyMap<string, number> => {
  const shared = new Map<string, number>();
  for (const commit of commits) {
    const paths = commit.toSorted();
    for (const [index, first] of paths.entries()) {
      for (const second of paths.slice(index + 1)) {
        const pair = first + PAIR_SEPARATOR + second;
        shared.set(pair, (shared.get(pair) ?? 0) + 1);
      }
    }
  }
  return shared;
};

/**
 * Finds the coupled pairs among `commits`, each the distinct paths one commit
 * touched. `revisions` counts every commit per path, including the ones
 * ignored here for being too large.
 *
 * `couplingCommits` is the number of commits small enough to count. Pairs
 * are sorted by degree, then shared commits, then path.
 */
export const findCouplings = (
  commits: ReadonlyArray<ReadonlyArray<string>>,
  revisions: ReadonlyMap<string, number>,
): {
  readonly couplingCommits: number;
  readonly couplings: ReadonlyArray<Coupling>;
} => {
  const counted = commits.filter((commit) => commit.length <= MAX_COMMIT_FILES);
  const couplings: Array<Coupling> = [];
  for (const [pair, sharedCommits] of countSharedCommits(counted)) {
    const [a = "", b = ""] = pair.split(PAIR_SEPARATOR);
    const meanRevisions =
      ((revisions.get(a) ?? 0) + (revisions.get(b) ?? 0)) / 2;
    const degree = sharedCommits / meanRevisions;
    if (sharedCommits >= MIN_SHARED_COMMITS && degree >= MIN_DEGREE) {
      couplings.push({
        a,
        b,
        sharedCommits,
        degree,
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
