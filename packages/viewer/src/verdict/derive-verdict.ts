// Owns the repository-level answer to "does the design hold up to the way the
// code changes?". It is derived here from the report's territories and
// erosion; it reads an engine-provided verdict instead once the report
// carries one.
import type { Report } from "@codeheat/engine";

import type { TerritoryIndex } from "../territories/territory-index.js";
import { leaksOf } from "./leaks.js";
import type { Leaks } from "./leaks.js";
import { quietWindowOf } from "./quiet-window.js";

/** `holds`: territories that contain their changes hold most of the work. `unknown`: nothing to judge. */
export type VerdictLevel = "holds" | "mixed" | "strained" | "unknown";

export type Verdict = {
  readonly level: VerdictLevel;
  /** Two or three words naming the level, for a badge beside the question. */
  readonly label: string;
  /** Why there is no verdict, in one sentence; empty for a known level, whose numbers the answer cards show. */
  readonly reason: string;
  /** A line under the reason: where the history last changed and what to try, for a window without counted changes; empty otherwise. */
  readonly note: string;
};

/** The share of all the change effort the judged territories must hold for the verdict to rest on evidence. */
const MIN_COVERAGE = 0.5;
/** Share of the change effort in leaking territories below which the design holds. */
const HOLDS_BELOW = 0.2;
/** Share from which the design is under strain; between the two it holds in parts. */
const STRAINED_FROM = 0.5;

const LABELS: Record<VerdictLevel, string> = {
  holds: "Holds up",
  mixed: "Holds in parts",
  strained: "Under strain",
  unknown: "Not enough evidence",
};

const baseLevel = (share: number): VerdictLevel => {
  if (share < HOLDS_BELOW) {
    return "holds";
  }
  return share < STRAINED_FROM ? "mixed" : "strained";
};

/** A design that erodes is judged one level worse; one that improves is not judged better. */
const WORSE: Record<VerdictLevel, VerdictLevel> = {
  holds: "mixed",
  mixed: "strained",
  strained: "strained",
  unknown: "unknown",
};

const withTrend = (level: VerdictLevel, report: Report): VerdictLevel =>
  report.erosion?.verdict === "eroding" ? WORSE[level] : level;

const NO_TERRITORIES =
  "This report has no territories, so it cannot say whether the design holds; analyze again with a current codeheat.";

const TOO_LITTLE_EVIDENCE =
  "Too little of the change effort sits in territories with enough changes to judge the design.";

const levelOf = (report: Report, leaks: Leaks | null): VerdictLevel =>
  leaks !== null && leaks.coverage >= MIN_COVERAGE
    ? withTrend(baseLevel(leaks.heatShare), report)
    : "unknown";

/** Why there is no verdict: no territories, a window without counted changes (with a note on when the history last changed), or too little evidence. */
const unknownOf = (report: Report): Pick<Verdict, "reason" | "note"> => {
  if (report.territories.nodes.length === 0) {
    return { reason: NO_TERRITORIES, note: "" };
  }
  const quiet = quietWindowOf(report);
  return quiet === null
    ? { reason: TOO_LITTLE_EVIDENCE, note: "" }
    : { reason: quiet.sentence, note: quiet.note };
};

/**
 * Whether the design holds up to the way the code changes, for the whole
 * repository: the share of all the change effort in territories that keep
 * leaking into their neighbors decides the level, an eroding trend lowers it,
 * and with less than half of the effort in territories that can be judged
 * there is no verdict, and the reason says why.
 */
export const deriveVerdict = (
  report: Report,
  territories: TerritoryIndex,
): Verdict => {
  const level = levelOf(report, leaksOf(report, territories));
  return {
    level,
    label: LABELS[level],
    ...(level === "unknown" ? unknownOf(report) : { reason: "", note: "" }),
  };
};
