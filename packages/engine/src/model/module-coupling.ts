// Owns the module-level coupling part of the report contract: how often two
// modules change in the same changes, the data a coupling matrix renders.
// Additive fields keep schemaVersion 1; renaming or removing a field bumps it.
import { Schema } from "effect";

import { Count, UnitInterval } from "./scalars.js";

/**
 * Two ranked modules (see `Module`: enough counted changes, not test-only) that
 * change in the same counted changes. A change that touched a contract file
 * counts as a touch of the module the contract lives in.
 */
export const ModuleCoupling = Schema.Struct({
  /** `path` of the module that sorts first by path. */
  a: Schema.String,
  /** `path` of the other module. */
  b: Schema.String,
  /** Counted changes that touched both modules; at least `Thresholds.minSharedCommits`. */
  sharedCommits: Count,
  /**
   * `sharedCommits / min(commits of a, commits of b)`, rounded to 4 decimals:
   * how much of the smaller module's change history happened together with the
   * other. 1 means every change that touched the smaller module touched the
   * other as well.
   */
  share: UnitInterval,
});
export type ModuleCoupling = typeof ModuleCoupling.Type;
