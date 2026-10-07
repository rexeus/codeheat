// Owns the logical-change part of the report contract: how the window's real
// commits were grouped into the changes that coupling and cohesion count.
// Additive fields keep schemaVersion 1; renaming or removing a field bumps it.
import { Schema } from "effect";

import { Count } from "./scalars.js";

/**
 * How the real commits (not `Analysis.mechanicalCommits`) of the window were
 * grouped into logical changes, the unit that coupling, module cohesion, and
 * interface churn count (`FileStats.revisions` stays per commit). Commits
 * belong to one change when they share a pull request (a squash-merge subject
 * suffix such as `(#123)`, or the merge commit that brought them in) or the
 * same ticket key (such as `PROJ-42` in the subject) within 14 days of the
 * first of them; a group of more than 30 commits, or a ticket group that would
 * span more than 50 files, is not one change. A change's files are the union
 * of its commits' files, and the size limit `Thresholds.maxCommitFiles`
 * applies to it as a whole.
 */
export const LogicalChanges = Schema.Struct({
  /**
   * What the grouping rests on: `pr` when only pull requests joined commits,
   * `ticket` when only ticket keys did, `mixed` when both did, and `commit`
   * when no commits were joined, so every change is one commit.
   */
  by: Schema.Literals(["pr", "ticket", "mixed", "commit"]),
  /** Logical changes in the window, before the size limit: `window.realCommits` when `by` is `commit`. */
  count: Count,
  /** The most commits one change holds; 0 without real commits, otherwise at least 1. */
  largest: Count,
});
