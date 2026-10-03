// Owns the report fields that say which commits an analysis counted: the
// window, the commits it left out, and how it grouped the rest.
// They are a group of their own so that `Report` stays within its size.
// Additive fields keep schemaVersion 1; renaming or removing a field bumps it.
import { AnalysisWindow } from "./analysis-window.js";
import { LogicalChanges } from "./logical-changes.js";
import { MechanicalCommits } from "./mechanical-commits.js";

/** Fields of `Report`; each is documented here, where it is defined. */
export const WindowFields = {
  /** The current window; with `--compare`, every field of the report describes it. */
  window: AnalysisWindow,
  /** How many commits of `window.commits` are mechanical (see `MechanicalCommits`). */
  mechanicalCommits: MechanicalCommits,
  /** How the window's real commits were grouped into the changes that are counted. */
  logicalChanges: LogicalChanges,
};
