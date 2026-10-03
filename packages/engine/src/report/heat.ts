// Owns the part of the report contract that says how old a hotspot is: hot in
// most windows of the series (chronic), or only in the latest (acute).
// Additive fields keep schemaVersion 1; renaming or removing a field bumps it.
import { Schema } from "effect";

import { Count } from "./scalars.js";

/**
 * How long a file has been among the hottest. A window of `Report.series` is
 * judged on its own: a file is hot in it when it has revisions in the window
 * and its score (see `FileStats.score`, computed from the window's revisions)
 * is among the best `Thresholds.hotTopShare` of the non-test files that have
 * revisions in the window, ties at the cut-off included. Only active windows
 * count (see `SeriesWindow.active`), and a file counts from the first window
 * in which it has a revision, which is all git shows of when it appeared.
 */
export const Heat = Schema.Struct({
  /**
   * `chronic`: hot in at least half of the windows that count for the file,
   * which are at least `Thresholds.minTrendWindows`, so a design problem
   * rather than a feature that was being built. `acute`: hot in one of the
   * last two windows and in none before, in a series with an earlier active
   * window to compare with, so current work. A file that is neither has no
   * `heat`.
   */
  kind: Schema.Literals(["chronic", "acute"]),
  /** Windows in which the file was hot. */
  hotWindows: Count,
  /** Windows that count for the file: the active ones from its first revision on. */
  windows: Count,
});
export type Heat = typeof Heat.Type;
