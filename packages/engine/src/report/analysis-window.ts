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
   * `Report.mechanicalCommits`). 0 means the window has no real change: with
   * `--compare`, there is nothing to compare, even when `commits` is not 0.
   */
  realCommits: Count,
  /**
   * Logical changes that count for coupling, cohesion, and interface churn
   * (see `Report.logicalChanges`; one per commit unless commits were
   * grouped): made of real commits (not mechanical, see
   * `Report.mechanicalCommits`) and not too large (see
   * `Thresholds.maxCommitFiles`).
   */
  couplingCommits: Count,
});
