// Owns the part of the report contract that describes the analysis window as
// consecutive windows: how far a change spread in each.
// Additive fields keep schemaVersion 1; renaming or removing a field bumps it.
import { Schema } from "effect";

import { ChangeRadius, PropagationCost } from "./change-radius.js";
import { Count } from "./scalars.js";

/**
 * One window of `Report.series`: the change radius and the propagation cost
 * of the counted changes (see `Report.logicalChanges`) that landed in it, over
 * the modules and files of the report. The windows are measured like the
 * analysis window, so the numbers follow the same definitions, but each
 * window groups, couples, and counts only its own commits: a pull request
 * that spans two windows is split between them.
 */
export const SeriesWindow = Schema.Struct({
  since: Schema.String,
  /** Equals the next window's `since`; the last window ends at `window.until`. */
  until: Schema.String,
  /** Counted changes in the window (the window's `couplingCommits`). */
  changes: Count,
  /**
   * The window has at least `Thresholds.minWindowChanges` counted changes.
   * The numbers of a window without that evidence are reported, but no
   * verdict, trend, or classification rests on them.
   */
  active: Schema.Boolean,
  /** See `Report.changeRadius`; null when no counted change touched a module. */
  changeRadius: Schema.NullOr(ChangeRadius),
  /** See `Report.propagationCost`; null without two files to couple. */
  propagationCost: Schema.NullOr(PropagationCost),
});
export type SeriesWindow = typeof SeriesWindow.Type;
