// Owns the report fields that say what an analysis counted: the window, the
// commits it left out, how it grouped the rest, the files it left out by
// name, and the sizes of its lists.
// They are a group of their own so that `Analysis` stays within its size.
// Additive fields keep schemaVersion 1; renaming or removing a field bumps it.
import { Schema } from "effect";

import { AnalysisWindow } from "./analysis-window.js";
import { ExcludeCount } from "./excludes.js";
import { LogicalChanges } from "./logical-changes.js";
import { MechanicalCommits } from "./mechanical-commits.js";
import { Totals } from "./totals.js";

/** Fields of `Analysis`; each is documented here, where it is defined. */
export const WindowFields = {
  /** The current window; with `--compare`, every field of the report describes it. */
  window: AnalysisWindow,
  /** How many commits of `window.commits` are mechanical (see `MechanicalCommits`). */
  mechanicalCommits: MechanicalCommits,
  /** How the window's real commits were grouped into the changes that are counted. */
  logicalChanges: LogicalChanges,
  /**
   * Every exclude pattern the analysis applied, in the order that decides
   * which leaves a file out: the default list (unless `--no-default-excludes`),
   * then `--exclude` in the order given, each once. Excluded files are in no
   * list and no measure.
   */
  excludes: Schema.Array(ExcludeCount),
  /** Sizes before any output limit (see `Totals`). */
  totals: Totals,
};
