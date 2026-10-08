// Owns the answer of report v2, read from the analysis's verdict.
import type { Analysis } from "../model/analysis.js";
import type { Answer } from "../report/answer.js";
import { thinEvidenceOf } from "../verdict/evidence.js";
import { summaryOf } from "./summary.js";
import { percentDownOf } from "./units.js";

/**
 * The answer of `analysis`: its verdict, in one sentence, with how strong the
 * evidence is; `restHeat` is the percent of all the heat in no listed area.
 */
export const answerOf = (
  analysis: Pick<Analysis, "verdict" | "window" | "repository" | "thresholds">,
  restHeat: number,
): Answer => {
  const { verdict } = analysis;
  const thin = thinEvidenceOf(analysis);
  const answer: Answer = {
    level: verdict.level,
    summary: summaryOf(analysis, thin, restHeat),
    leakingHeat:
      verdict.level === "unknown" ? null : percentDownOf(verdict.leakShare),
    trend: verdict.trend,
    evidence: thin === null ? "strong" : "thin",
  };
  return verdict.reason === null
    ? answer
    : { ...answer, reason: verdict.reason };
};
