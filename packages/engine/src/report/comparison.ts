// Owns the part of the report contract that describes how a window compares to
// the one before it (`analyze --compare`).
// Additive fields keep schemaVersion 1; renaming or removing a field bumps it.
import { Schema } from "effect";

import { Count, UnitDelta, UnitInterval } from "./scalars.js";

/** The window before the analysis window that `analyze --compare` measured, adjacent to it. */
export const Comparison = Schema.Struct({
  previousSince: Schema.String,
  /** Equals `window.since`; no commit is in both windows. */
  previousUntil: Schema.String,
  /**
   * Non-merge commits in the previous window that touched at least one
   * universe file, counted as `window.commits` is.
   */
  previousCommits: Count,
  /**
   * The commits among `previousCommits` that are not mechanical, counted as
   * `window.realCommits` is. 0 means there is nothing to compare against:
   * every trend is null, which is not the same as "nothing changed".
   */
  previousRealCommits: Count,
  /**
   * The previous window reaches back past the oldest reachable commit, because
   * the repository is younger than the two windows together or a shallow clone
   * cut its history. Its numbers then cover less than the full window.
   */
  previousTruncated: Schema.Boolean,
});

/** How a file's score changed against the window before (`analyze --compare`). */
export const FileTrend = Schema.Struct({
  /** The score the file had in the previous window, normalized within that window; rounded to 4 decimals. */
  previousScore: UnitInterval,
  /** Revisions the file had in the previous window. */
  previousRevisions: Count,
  /** `score - previousScore`, rounded to 4 decimals; positive means the file got hotter relative to its window's hottest. */
  scoreDelta: UnitDelta,
  /**
   * The file had no revision in the previous window but has in the latest one.
   * Its `scoreDelta` is then just its score, not a file warming up; rank
   * warming only among files where this is false.
   */
  newlyActive: Schema.Boolean,
});
