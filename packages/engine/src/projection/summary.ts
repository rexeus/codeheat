// Owns the answer in one sentence: the words the terminal, the HTML report,
// and agents share for the verdict, its trend, and why its evidence is thin.
import type { Analysis } from "../model/analysis.js";
import type { ThinEvidence } from "../verdict/evidence.js";
import { percentDownOf } from "./units.js";

type Verdict = Analysis["verdict"];

const LABELS: Record<Verdict["level"], string> = {
  holds: "Holds up",
  mixed: "Holds in parts",
  strained: "Under strain",
  unknown: "Not enough evidence",
};

const TREND_WORDS: Record<Exclude<Verdict["trend"], "unknown">, string> = {
  eroding: "getting worse",
  improving: "getting better",
  holding: "holding steady",
};

const UNKNOWN_WHY: Record<NonNullable<Verdict["reason"]>, string> = {
  "no-territories": "the repository has no files to judge.",
  "quiet-window":
    "no counted changes in this window, so there is nothing to judge.",
  "too-little-evidence":
    "too little of the change effort sits in areas with enough changes to judge.",
};

const counted = (count: number, one: string, many: string): string =>
  `${count} ${count === 1 ? one : many}`;

/** Why a known level rests on thin evidence, as the end of the sentence. */
const THIN_WORDS: Record<
  Exclude<ThinEvidence, "no-level">,
  (analysis: Pick<Analysis, "verdict" | "window">) => string
> = {
  "few-changes": ({ window }) =>
    `judged on only ${counted(window.couplingCommits, "change", "changes")}`,
  "few-areas": ({ verdict }) =>
    `judged on only ${counted(verdict.judged.length, "area", "areas")}`,
  shallow: () => "judged on a shallow clone",
};

/**
 * The verdict of `analysis` in one sentence of plain words: the level, the
 * trend when there is one, the whole percent of the change effort in leaking
 * areas (rounded down, as the level is decided below each cut point), and why the evidence is thin (`thin`, see `thinEvidenceOf`); for an
 * `unknown` level, why there is none.
 */
export const summaryOf = (
  analysis: Pick<Analysis, "verdict" | "window">,
  thin: ThinEvidence | null,
): string => {
  const { level, reason, trend, leakShare } = analysis.verdict;
  if (reason !== null) {
    return `${LABELS[level]}: ${UNKNOWN_WHY[reason]}`;
  }
  const lead =
    trend === "unknown"
      ? LABELS[level]
      : `${LABELS[level]}, ${TREND_WORDS[trend]}`;
  const tail =
    thin === null || thin === "no-level"
      ? ""
      : `, ${THIN_WORDS[thin](analysis)}`;
  return `${lead}: ${Math.floor(percentDownOf(leakShare))}% of the change effort sits in areas that leak${tail}.`;
};
