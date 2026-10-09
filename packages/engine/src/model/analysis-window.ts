// Owns the analysis-window part of the report contract: the history range and what it holds.
// Additive fields keep schemaVersion 1; renaming or removing a field bumps it.
import { Schema } from "effect";

import { Count } from "./scalars.js";

/** The history range an analysis covers, resolved to ISO timestamps. */
export const AnalysisWindow = Schema.Struct({
  since: Schema.String,
  until: Schema.String,
  /**
   * Non-merge commits in the window that touched at least one universe file,
   * or a file deleted at a universe path (a path recreated later starts afresh).
   */
  commits: Count,
  /**
   * The commits among `commits` that are not mechanical (see
   * `Analysis.mechanicalCommits`) and touched code other than test code: the
   * commits the changes are made of. 0 means the window has no real change:
   * with `--compare`, there is nothing to compare, even when `commits` is not
   * 0.
   */
  realCommits: Count,
  /**
   * Logical changes that count for coupling, cohesion, and interface churn
   * (see `Analysis.logicalChanges`; one per commit unless commits were
   * grouped): made of real commits (not mechanical, see
   * `Analysis.mechanicalCommits`) and not too large (see
   * `Thresholds.maxCommitFiles`).
   */
  couplingCommits: Count,
  /**
   * When the newest commit of the repository was made, as an ISO timestamp
   * (the committer time of `HEAD`), whatever the window. It is the repository's
   * newest commit, which need not touch an analysed file (a documentation-only
   * commit, an analysis of one folder), so it is not when the analysed code
   * last changed. Null for a repository without commits.
   */
  lastCommitAt: Schema.NullOr(Schema.String),
});
