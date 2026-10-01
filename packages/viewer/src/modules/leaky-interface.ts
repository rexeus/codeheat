import type { Module } from "@codeheat/engine";

/**
 * Whether a module's entry points change with its implementation often enough
 * to call out: the same rule that gives their files a reason in the report (test-only
 * modules never qualify).
 */
export const isLeakyInterface = (
  { leakage, implementationCommits, testOnly }: Module,
  thresholds: {
    readonly minLeakage: number;
    readonly minImplementationCommits: number;
  },
): boolean =>
  !testOnly &&
  leakage !== null &&
  leakage >= thresholds.minLeakage &&
  implementationCommits >= thresholds.minImplementationCommits;
