import type { Module } from "@codeheat/engine";

/** Modules the overview lists as least cohesive. */
const LEAST_COHESIVE_LIMIT = 5;

/**
 * The first five ranked modules of `modules`, which the report already lists
 * least cohesive first: the ones with at least `minCommits` counted commits.
 * A share of two commits says little.
 */
export const leastCohesive = (
  modules: readonly Module[],
  minCommits: number,
): Module[] =>
  modules
    .filter(({ commits }) => commits >= minCommits)
    .slice(0, LEAST_COHESIVE_LIMIT);
