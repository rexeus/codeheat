// Owns the report fields that answer whether the design holds up to the way
// the code changes: how far a change spreads, and how that moved over time.
// They are a group of their own so that `Analysis` stays within its size.
// Additive fields keep schemaVersion 1; renaming or removing a field bumps it.
import { Schema } from "effect";

import { ChangeRadius, PropagationCost } from "./change-radius.js";
import { EntryPoint } from "./entry-point.js";
import { Erosion } from "./erosion.js";
import { FixDensity } from "./fix-density.js";
import { SeriesWindow } from "./series.js";
import { TerritoryClique, TerritoryCoupling } from "./territory-coupling.js";
import { Territories } from "./territory.js";
import { Verdict } from "./verdict.js";

/** Fields of `Analysis`; each is documented here, where it is defined. */
export const DesignFitFields = {
  /**
   * Whether the design holds up to the way the code changes, for the whole
   * repository, judged from the territories at the recommended detail and
   * `erosion` (see `Verdict`): the answer the HTML report shows beside the
   * question.
   */
  verdict: Verdict,
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
  /**
   * How often the hottest territories at the recommended detail change in the
   * same changes (see `TerritoryCoupling`): the data of a territory matrix.
   * Not cut by `--limit`. v2 moves it under `coupling`.
   */
  territoryCoupling: Schema.Array(TerritoryCoupling),
  /**
   * The groups of three or more territories at the recommended detail that
   * change as one unit (see `TerritoryClique`), at most 50. Not cut by
   * `--limit`. v2 moves it under `coupling`.
   */
  territoryCliques: Schema.Array(TerritoryClique),
  /**
   * Where to start: at most `thresholds.maxEntries` places where the design
   * fails to hold up to the way the code changes, each with the evidence, a
   * verdict, and a design move (see `EntryPoint`). Territories are judged at
   * the recommended detail; buckets of smaller folders never qualify. At most `thresholds.maxEntriesPerKind`
   * entries per kind, every one scoring at least `thresholds.minEntryScore`
   * except the best of each kind, which is always listed (see GLOSSARY.md,
   * "Entry point (of a report)"), so the list shows every kind of weakness the
   * repository has. Empty when nothing qualifies. `--limit` does not cut it.
   */
  entryPoints: Schema.Array(EntryPoint),
};
