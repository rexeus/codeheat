// Owns whether the verdict rests on strong or thin evidence, and why.
import type { Analysis } from "../model/analysis.js";

/**
 * Fewer counted changes in the window make the evidence thin: at about 100
 * changes the judged territories hold 5 to 20 changes each, where one change
 * moves a containment by 5 to 20 points, across the line at which a territory
 * leaks.
 */
export const THIN_BELOW_CHANGES = 100;
/** Fewer judged territories make the evidence thin: the answer would be the answer of one or two territories. */
export const THIN_BELOW_AREAS = 3;

/**
 * Why the evidence is thin, in the order it is checked. `no-level`: the
 * verdict is `unknown`. `few-changes`: fewer than `thinBelowChanges` counted
 * changes. `few-areas`: fewer than `thinBelowAreas` judged territories.
 * `shallow`: the clone lacks the history before its oldest fetched commit, so
 * every count undercounts.
 */
export type ThinEvidence = "no-level" | "few-changes" | "few-areas" | "shallow";

/**
 * Why the verdict of `analysis` rests on thin evidence, or null when it rests
 * on strong evidence. A long quiet stretch before the end of the window is
 * not thin evidence: the code has not changed since, so the verdict still
 * describes it.
 */
export const thinEvidenceOf = (
  analysis: Pick<Analysis, "verdict" | "window" | "repository" | "thresholds">,
): ThinEvidence | null => {
  const { verdict, window, repository, thresholds } = analysis;
  if (verdict.level === "unknown") {
    return "no-level";
  }
  if (window.couplingCommits < thresholds.thinBelowChanges) {
    return "few-changes";
  }
  if (verdict.judged.length < thresholds.thinBelowAreas) {
    return "few-areas";
  }
  return repository.shallow ? "shallow" : null;
};
