// Owns the verdict part of the report contract: whether the design holds up
// to the way the code changes, for the whole repository, and the numbers
// behind that answer.
// Additive fields keep schemaVersion 1; renaming or removing a field bumps it.
import { Schema } from "effect";

import { UnitInterval } from "./scalars.js";

/**
 * The answer to "does the design hold up to the way the code changes?", the
 * one the HTML report shows beside the question. It judges the territories at
 * `Territories.recommended` that are real parts of the design (`package`,
 * `folder`, `group`). A territory is judged when it has at least
 * `Thresholds.minModuleCommits` counted changes and a `fit.containment`
 * (one with heat but no counted change, because every change touching it was
 * larger than `Thresholds.maxCommitFiles` files, is not). It leaks when at
 * most `Thresholds.maxEntryContainment` of its changes stay inside and another
 * territory shares changes with it (`fit.partner`); one that keeps little
 * inside but has no partner says nothing about where it leaks and is not
 * judged. The share of all the heat in leaking territories decides the level.
 */
export const Verdict = Schema.Struct({
  /**
   * `holds`: less than `Thresholds.minMixedLeakShare` of all the heat sits in
   * leaking territories; `mixed`: less than `Thresholds.minStrainedLeakShare`;
   * `strained`: from `Thresholds.minStrainedLeakShare` on. An `eroding`
   * design is one level worse (`strained` stays `strained`); an improving one
   * is not judged better. `unknown`: the judged territories hold less than
   * `Thresholds.minVerdictCoverage` of all the heat, or none is judged (see
   * `reason`).
   */
  level: Schema.Literals(["holds", "mixed", "strained", "unknown"]),
  /**
   * Why the level is `unknown`, null for a known level. `no-territories`: the
   * report has no territories (the universe has no files). `quiet-window`: the
   * window has no real commit (`window.realCommits` is 0), so there is nothing
   * to judge; `window.lastCommitAt` and `series` say where the history last
   * changed. `too-little-evidence`: too little of the change effort sits in
   * territories with enough changes to judge.
   */
  reason: Schema.NullOr(
    Schema.Literals(["no-territories", "quiet-window", "too-little-evidence"]),
  ),
  /**
   * The share of all the heat (`Territory.heatShare` summed, test code
   * included) in the leaking territories, rounded to 4 decimals; 0 when none
   * is judged.
   */
  leakShare: UnitInterval,
  /** The share of all the heat in the judged territories, leaking or not, rounded to 4 decimals. */
  coverage: UnitInterval,
  /** `id`s of the judged territories, the most heat first. */
  judged: Schema.Array(Schema.String),
  /** Of those, the leaking ones, the most heat first. */
  leaking: Schema.Array(Schema.String),
  /** `trend` is `eroding`, which lowers a known level by one. */
  eroding: Schema.Boolean,
  /**
   * Whether the `judged` territories keep more or less of their changes
   * inside over `Report.series`. Per window, their stays: of the counted
   * changes of the window that touched a judged territory, each counted once,
   * the share that touched no other territory, at the recommended detail. A
   * window counts with at least `Thresholds.minWindowChanges` counted changes
   * and as many that touched a judged territory.
   * A robust line through those windows is judged with the gate of
   * `Erosion.verdict`: `eroding` or `improving` only when it moved by at least
   * `Thresholds.minErosionShift` and `Thresholds.minErosionSigmas` standard
   * errors of the shift, also without its first and last window; otherwise
   * `holding`. `unknown` with fewer than `Thresholds.minVerdictWindows`
   * windows. Unlike `erosion.verdict`, which reads modules, it reads the
   * territories the verdict judges.
   */
  trend: Schema.Literals(["eroding", "improving", "holding", "unknown"]),
});
export type Verdict = typeof Verdict.Type;
