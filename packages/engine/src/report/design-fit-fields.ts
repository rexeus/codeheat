// Owns the report fields that answer whether the design holds up to the way
// the code changes: how far a change spreads, and how that moved over time.
// They are a group of their own so that `Report` stays within its size.
// Additive fields keep schemaVersion 1; renaming or removing a field bumps it.
import { Schema } from "effect";

import { ChangeRadius, PropagationCost } from "./change-radius.js";
import { Erosion } from "./erosion.js";
import { FixDensity } from "./fix-density.js";
import { SeriesWindow } from "./series.js";
import { Territories } from "./territory.js";

/** Fields of `Report`; each is documented here, where it is defined. */
export const DesignFitFields = {
  /** How far a counted change spreads over `modules` (see `ChangeRadius`); null when none touched a module. */
  changeRadius: Schema.NullOr(ChangeRadius),
  /** How much of the code a change drags along, read from `couplings` (see `PropagationCost`); null without two files to couple. */
  propagationCost: Schema.NullOr(PropagationCost),
  /**
   * The last 24 months or more (see `seriesSince`) cut into consecutive
   * windows of equal length, oldest first, with how far a change spread in
   * each (see `SeriesWindow`). They are about a quarter of a year (91 days)
   * long, at most 12: a span longer than three years has windows longer than a
   * quarter. Empty when the span, which starts at the first commit if the
   * history is shorter, is under one and a half quarters (about 4.5 months,
   * 20 weeks): one window has no series.
   */
  series: Schema.Array(SeriesWindow),
  /**
   * Where `series` starts, which is the `since` of its first window; null
   * when `series` is empty. The series covers at least the last 24 months,
   * or the whole history if that is shorter, and more when the analysis
   * window is longer, so it can start before `window.since`; the measures
   * that describe the window itself (`files`, `couplings`, `modules`,
   * `changeRadius`, …) keep using `window`. `erosion`, `Module.erosion`, and
   * `FileStats.heat` come from the series.
   */
  seriesSince: Schema.NullOr(Schema.String),
  /** Whether the design keeps containing change over `series` (see `Erosion`); null exactly when `series` is empty. */
  erosion: Schema.NullOr(Erosion),
  /** How many of the counted changes are fixes (see `FixDensity`), and whether commit subjects tell. */
  fixDensity: FixDensity,
  /** The areas of the code at every detail and the one to read first (see `Territories`); `modules` is unchanged. */
  territories: Territories,
};
