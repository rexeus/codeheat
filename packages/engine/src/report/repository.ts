// Owns which repository report v2 describes and which stretch of its history.
import { Schema } from "effect";

import { Count, Day } from "./scalars.js";

/** The repository a report describes. */
export const Repository = Schema.Struct({
  /**
   * The repository's name: the folder of its work tree, or, in a linked work
   * tree (`git worktree add`), the folder that holds its `.git` or a bare
   * repository's name without `.git`.
   */
  name: Schema.String,
  /** The `HEAD` commit, or null for a repository without commits. */
  head: Schema.NullOr(Schema.String),
  /** When the analysis ran, as an ISO timestamp: the end of the window. */
  analyzedAt: Schema.String,
});

/** The stretch of history the numbers rest on. */
export const Window = Schema.Struct({
  since: Day,
  until: Day,
  /**
   * The changes the numbers count: logical changes (commits joined by pull
   * request or ticket) that are not mechanical (renames, whitespace, reverted
   * pairs, duplicates) and touch at most `basis.thresholds.maxChangeFiles`
   * files. Every `changes` of the report counts these.
   */
  changes: Count,
  /** The day of the repository's newest commit, whatever the window; null for a repository without commits. */
  lastCommitAt: Schema.NullOr(Day),
});
