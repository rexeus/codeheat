// Owns the change-radius part of the report contract: how many modules a
// typical change reaches.
// Additive fields keep schemaVersion 1; renaming or removing a field bumps it.
import { Schema } from "effect";

import { UnitInterval } from "./scalars.js";

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
