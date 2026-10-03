// Owns the report fields that answer whether the design holds up to the way
// the code changes: how far a change spreads, and how that moved over time.
// They are a group of their own so that `Report` stays within its size.
// Additive fields keep schemaVersion 1; renaming or removing a field bumps it.
import { Schema } from "effect";

import { ChangeRadius, PropagationCost } from "./change-radius.js";
import { Erosion } from "./erosion.js";
import { SeriesWindow } from "./series.js";

/** Fields of `Report`; each is documented here, where it is defined. */
export const DesignFitFields = {
  /** How far a counted change spreads over `modules` (see `ChangeRadius`); null when none touched a module. */
  changeRadius: Schema.NullOr(ChangeRadius),
  /** How much of the code a change drags along, read from `couplings` (see `PropagationCost`); null without two files to couple. */
  propagationCost: Schema.NullOr(PropagationCost),
  /**
   * The analysis window cut into consecutive windows of about a quarter of a
   * year each, oldest first, at most 12, with how far a change spread in each
   * (see `SeriesWindow`). Empty when the window is shorter than six weeks: one
   * window has no series. With `--compare` it cuts the latest window only.
   */
  series: Schema.Array(SeriesWindow),
  /** Whether the design keeps containing change over `series` (see `Erosion`); null exactly when `series` is empty. */
  erosion: Schema.NullOr(Erosion),
};
