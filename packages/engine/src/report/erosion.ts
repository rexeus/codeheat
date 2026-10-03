// Owns the erosion part of the report contract: whether the design keeps
// containing change over the windows of `Report.series`, for the repository
// and for each module.
// Additive fields keep schemaVersion 1; renaming or removing a field bumps it.
import { Schema } from "effect";

import { Count, UnitInterval } from "./scalars.js";

/**
 * A straight line fitted (least squares) through a measure over the windows
 * that have evidence, read at the first and at the last of them. Fitting
 * keeps one odd window from deciding the direction.
 */
export const TrendLine = Schema.Struct({
  /** The line's value at the first window with evidence, kept between 0 and 1 and rounded to 4 decimals. */
  from: UnitInterval,
  /** The line's value at the last window with evidence, kept between 0 and 1 and rounded to 4 decimals. */
  to: UnitInterval,
  /** Change per window of the series (not per window with evidence), rounded to 4 decimals; negative means falling. */
  slope: Schema.Finite,
});
export type TrendLine = typeof TrendLine.Type;

/**
 * How a module's cohesion moved over `Report.series`: the windows in which it
 * had at least as many counted changes as a window of that size needs to rank
 * a module (`Thresholds.minModuleCommits`, derived from the window's own
 * counted changes) carry evidence, and at least `Thresholds.minTrendWindows`
 * of them are needed for a trend. A module whose cohesion falls keeps
 * pulling other modules into its changes.
 */
export const ModuleErosion = Schema.Struct({
  ...TrendLine.fields,
  /** Windows with evidence the line is fitted through. */
  windows: Count,
  /**
   * The module's cohesion in each window of `Report.series`, in its order,
   * rounded to 4 decimals; null where the module has no evidence.
   */
  cohesion: Schema.Array(Schema.NullOr(UnitInterval)),
  /** The module has evidence in one of the last two windows, so it is still changing. */
  recent: Schema.Boolean,
});
export type ModuleErosion = typeof ModuleErosion.Type;

/**
 * What the series says about the repository as a whole. `locality` decides the
 * verdict: it is the share of the changes that stay in one module, so it does
 * not depend on how much work a window holds. The propagation cost is shown
 * for context only: it grows with the number of files that have enough changes
 * to be coupled, so a busier window raises it without the design getting
 * worse.
 */
export const Erosion = Schema.Struct({
  /**
   * `eroding`: changes stay in one module less often than they did, by at
   * least `Thresholds.minErosionShift` (the line's `to` against its `from`);
   * `improving`: more often, by as much; `holding`: neither.
   * `unknown`: fewer than `Thresholds.minTrendWindows` active windows with
   * counted changes to fit a line through.
   * The verdict is judged over the active windows (see `SeriesWindow.active`)
   * wherever they lie; the windows without activity are left out, so they can
   * neither cause nor hide it, and never make it `improving`. See
   * `inactiveSince` for a series that ends quiet.
   */
  verdict: Schema.Literals(["eroding", "improving", "holding", "unknown"]),
  /**
   * The `since` of the first window of the run of inactive windows that ends
   * the series: the repository has had fewer than
   * `Thresholds.minWindowChanges` counted changes a window since then. Null
   * when the last window is active. It says nothing about the verdict, which
   * describes the active period.
   */
  inactiveSince: Schema.NullOr(Schema.String),
  /** Active windows of the series that have a change radius: the ones the lines are fitted through. */
  windows: Count,
  /** `ChangeRadius.local` over the active windows; null with fewer than `Thresholds.minTrendWindows`. */
  locality: Schema.NullOr(TrendLine),
  /** `PropagationCost.cost` over the active windows that have one; null with fewer than `Thresholds.minTrendWindows`. */
  propagationCost: Schema.NullOr(TrendLine),
});
export type Erosion = typeof Erosion.Type;
