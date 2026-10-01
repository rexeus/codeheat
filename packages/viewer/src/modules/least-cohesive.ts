import type { Module } from "@codeheat/engine";

/** Modules the overview lists as least cohesive. */
const LEAST_COHESIVE_LIMIT = 5;

/**
 * The least cohesive modules, lowest first. Modules with fewer than
 * `minCommits` counted commits are left out: a share of two commits says
 * little. Modules without data (`cohesion` is `null`) never qualify.
 */
export const leastCohesive = (
  modules: readonly Module[],
  minCommits: number,
): Module[] =>
  modules
    .filter(
      ({ commits, cohesion }) => cohesion !== null && commits >= minCommits,
    )
    .toSorted(
      (a, b) =>
        (a.cohesion ?? 0) - (b.cohesion ?? 0) || a.path.localeCompare(b.path),
    )
    .slice(0, LEAST_COHESIVE_LIMIT);
