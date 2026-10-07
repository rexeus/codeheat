// Owns the change-radius part of the report contract: how many modules a
// typical change reaches, and how much of the code a change drags along.
// Additive fields keep schemaVersion 1; renaming or removing a field bumps it.
import { Schema } from "effect";

import { Count, UnitInterval } from "./scalars.js";

const ModuleCount = Schema.Int.check(Schema.isGreaterThanOrEqualTo(1));

/**
 * How far the counted changes of the window (see `Analysis.logicalChanges`)
 * spread over the modules of `Analysis.modules`, test-only modules left out
 * (the test of a change is no spread). A place that holds only contract files
 * (see `ModulePartner.contractsOnly`) counts as a module. Changes that touched
 * no other module than test-only ones, or none at all (only files that are
 * dead today), are not measured. The numbers depend on that partition: finer
 * modules give a larger radius.
 */
export const ChangeRadius = Schema.Struct({
  /** Counted changes that touched at least one module that is not test-only: the changes the other fields describe. Can be lower than `window.couplingCommits`. */
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
  /**
   * The files the mean runs over: code and contract files that are not test
   * code and took part in at least `Thresholds.minSharedCommits` counted
   * changes. At least 2. The cost shrinks as this number grows, so compare it
   * within one repository over time, not between repositories.
   */
  files: Count.check(Schema.isGreaterThanOrEqualTo(2)),
});
export type PropagationCost = typeof PropagationCost.Type;
