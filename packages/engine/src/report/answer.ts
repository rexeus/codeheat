// Owns the answer of report v2: whether the design holds up to the way the
// code changes, for the whole repository.
import { Schema } from "effect";

import { Percent } from "./scalars.js";

/**
 * The answer to "does the design hold up to the way the code changes?". An
 * area is judged when it has at least `basis.thresholds.judgedFromChanges`
 * changes and either keeps more than `leaksAtStays` of them inside or leaks
 * into a partner (`areas[].stays`, `areas[].leaksInto`).
 */
export const Answer = Schema.Struct({
  /**
   * `holds`: less than `basis.thresholds.mixedFromLeakingHeat` percent of all
   * the heat sits in areas that leak; `mixed`: less than
   * `strainedFromLeakingHeat`; `strained`: from there on. An `eroding` trend
   * makes the level one worse (`strained` stays `strained`). `unknown`: the
   * judged areas hold less than `judgedHeatNeeded` percent of the heat, or
   * none is judged (see `reason`).
   */
  level: Schema.Literals(["holds", "mixed", "strained", "unknown"]),
  /**
   * The answer in one sentence, safe to print: the level, the trend when there
   * is one, the leaking heat, and why the evidence is thin; for `unknown`,
   * why there is no level.
   */
  summary: Schema.String,
  /** Percent of all the heat that sits in areas that leak; null when `level` is `unknown`. */
  leakingHeat: Schema.NullOr(Percent),
  /**
   * Whether the judged areas keep more or less of their changes inside over
   * the last quarters. Per quarter, the share of the changes touching a
   * judged area that touched no other area, read along a robust line:
   * `eroding` or `improving` only when it moved clearly, otherwise
   * `holding`; `unknown` with fewer than five quarters of enough changes.
   */
  trend: Schema.Literals(["eroding", "improving", "holding", "unknown"]),
  /**
   * `thin` when the level is `unknown`, the repository is a shallow clone
   * (history before its oldest fetched commit is missing), the window has
   * fewer than `basis.thresholds.thinBelowChanges` changes, or fewer than
   * `thinBelowAreas` areas are judged; `strong` otherwise.
   */
  evidence: Schema.Literals(["strong", "thin"]),
  /**
   * Why the level is `unknown`, present only then. `no-files`: there are no
   * files to judge. `quiet-window`: the window has no real commit, only
   * mechanical ones or none. `too-little-evidence`: the judged areas hold
   * less than `basis.thresholds.judgedHeatNeeded` percent of the heat; the
   * rest sits in areas too quiet to judge, or in buckets of smaller folders
   * that are no areas (see `basis.rest`).
   */
  reason: Schema.optionalKey(
    Schema.Literals(["no-files", "quiet-window", "too-little-evidence"]),
  ),
});
export type Answer = typeof Answer.Type;
