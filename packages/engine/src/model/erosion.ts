// Owns the erosion part of the report contract: whether the design keeps
// containing change over the windows of `Analysis.series`, for the repository
// and for each module.
// Additive fields keep schemaVersion 1; renaming or removing a field bumps it.
import { Schema } from "effect";

import { Count, UnitInterval } from "./scalars.js";

/**
 * A robust straight line (Theil–Sen: the median of the slopes between every
 * two windows, and the median intercept) fitted through a measure over the
 * windows that have evidence, read at the first and at the last of them. One
 * odd window cannot turn it. It is the line's own value, not held to the range
 * of the measure: for a share near 0 or 1 it can lie slightly outside it.
 */
export const TrendLine = Schema.Struct({
  /** The line's value at the first window with evidence, rounded to 4 decimals. */
  from: Schema.Finite,
  /** The line's value at the last window with evidence, rounded to 4 decimals. */
  to: Schema.Finite,
  /** Change per window of the series (not per window with evidence), rounded to 4 decimals; negative means falling. */
  slope: Schema.Finite,
});
export type TrendLine = typeof TrendLine.Type;

/**
 * How a module's cohesion moved over `Analysis.series`: the windows in which it
 * had at least as many counted changes as a window of that size needs to rank
 * a module (`Thresholds.minModuleCommits`, derived from the window's own
 * counted changes) and at least `Thresholds.minWindowChanges` carry evidence,
 * and at least `Thresholds.minTrendWindows` of them are needed for a trend. A
 * module whose cohesion falls keeps pulling other modules into its changes.
 */
export const ModuleErosion = Schema.Struct({
  ...TrendLine.fields,
  /**
   * `eroding` or `improving` only when the line moved by at least
   * `Thresholds.minErosionShift` and `Thresholds.minErosionSigmas` standard
   * errors of the shift, and the same follows without its first and last
   * window (see `Erosion.verdict`; at least `Thresholds.minVerdictWindows`
   * windows), computed from the windows' numbers of counted changes; otherwise
   * `holding`: the module's share only wobbled.
   */
  verdict: Schema.Literals(["eroding", "improving", "holding"]),
  /** Windows with evidence the line is fitted through. */
  windows: Count,
  /**
   * The module's cohesion in each window of `Analysis.series`, in its order,
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
   * `eroding`: changes stay in one module less often than they did: the
   * line's `to` is below its `from` by at least `Thresholds.minErosionShift`
   * and by at least `Thresholds.minErosionSigmas` standard errors of that
   * shift. The error is the one of a weighted least-squares line through the
   * windows' shares, whose variance is binomial, `p(1-p)/changes` with `p` the
   * pooled share (not below 5 % or above 95 %), widened by 15 % for the
   * Theil–Sen estimator and for changes that burst together. A flat design
   * therefore reads `holding` in more than 95 % of the cases at 60 changes a
   * year and up. `improving`: the same, upward; `holding`: neither.
   * A fall or a rise is believed only when the same verdict follows from the
   * windows without the first and the last (a line fitted through the others
   * and the same gate), so one odd window at either end cannot decide it. That
   * needs at least `Thresholds.minVerdictWindows` windows with evidence: with
   * fewer the verdict is `holding` (or `unknown` below
   * `Thresholds.minTrendWindows`).
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
