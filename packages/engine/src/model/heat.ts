// Owns the part of the report contract that says how old a hotspot is: hot in
// most windows of the series (chronic), or only in the latest (acute).
// Additive fields keep schemaVersion 1; renaming or removing a field bumps it.
import { Schema } from "effect";

import { Count } from "./scalars.js";

/**
 * How long a file has been among the hottest. A window of `Analysis.series` is
 * judged on its own: a file is hot in it when it has revisions in the window
 * and its score (see `FileStats.score`, computed from the window's revisions)
 * is among the best `Thresholds.hotTopShare` of the files that have
 * revisions in the window, ties at the cut-off included. Only active windows
 * count (see `SeriesWindow.active`), and a file counts from the first window
 * in which it has a revision, which is all git shows of when it appeared.
 */
export const Heat = Schema.Struct({
  /**
   * `chronic`: at least `Thresholds.minTrendWindows` windows that count for
   * the file lie before the last two, and it was hot in at least half of
   * those and in at least half of all that count (`hotWindows` of
   * `windows`): a design problem rather than a feature that was being built,
   * and not one that cooled long ago. The
   * last two windows do not count towards this, so a series needs at least
   * five windows (about 15 months) before any file can be chronic. `acute`:
   * hot in both of the last two windows and in fewer than half of the windows
   * that count for the file before them, in a series with an active window
   * before them to compare with: current work. A file hot in all windows of a
   * series too short to call it chronic is neither. A file that is neither has
   * no `heat`.
   */
  kind: Schema.Literals(["chronic", "acute"]),
  /** Windows in which the file was hot, the last two included. */
  hotWindows: Count,
  /** Windows that count for the file, the last two included: the active ones from its first revision on. */
  windows: Count,
});
export type Heat = typeof Heat.Type;
