// Owns the change-radius part of the report contract: how many modules a
// typical change reaches, and how much of the code a change drags along.
// Additive fields keep schemaVersion 1; renaming or removing a field bumps it.
import { Schema } from "effect";

import { Count, UnitInterval } from "./scalars.js";

const ModuleCount = Schema.Int.check(Schema.isGreaterThanOrEqualTo(1));

/**
 * How far the counted changes of the window (see `Report.logicalChanges`)
 * spread over the modules of `Report.modules`, test-only modules left out
 * (the test of a change is no spread). Changes that touched no other module
 * than test-only ones, or none at all, are not measured. The numbers depend
 * on that partition: finer modules give a larger radius.
 */
export const ChangeRadius = Schema.Struct({
  /** Counted changes that touched at least one module that is not test-only: the changes the other fields describe. */
  changes: Schema.Int.check(Schema.isGreaterThanOrEqualTo(1)),
  /**
   * The modules a typical change touched: the lower median of the changes'
   * module counts (the value of the middle change, the earlier one when the
   * count is even), so a whole number.
   */
  median: ModuleCount,
  /** Nine in ten changes touched at most this many modules (nearest rank). */
  p90: ModuleCount,
  /** Share of the measured changes that touched exactly one module, rounded to 4 decimals. */
  local: UnitInterval,
});
export type ChangeRadius = typeof ChangeRadius.Type;

/**
 * The co-change graph's reach, the share of the code a change to one file
 * drags along (MacCormack, Rusnak, and Baldwin's propagation cost, read from
 * co-change instead of dependencies).
 */
export const PropagationCost = Schema.Struct({
  /**
   * Mean over `files` of the share of the other `files` that a file reaches
   * through chains of at most `Thresholds.propagationDepth` couplings, rounded
   * to 4 decimals: 0 when no file is coupled, 1 when every file reaches all
   * the others.
   */
  cost: UnitInterval,
  /** The files the mean runs over: code files of the universe that took part in a counted change. At least 2. */
  files: Count.check(Schema.isGreaterThanOrEqualTo(2)),
});
export type PropagationCost = typeof PropagationCost.Type;
