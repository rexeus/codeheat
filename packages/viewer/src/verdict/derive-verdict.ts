// Owns the repository-level answer to "does the design hold up to the way the
// code changes?". It is derived here from the report's territories, entry
// points, propagation cost, and erosion; it reads an engine-provided verdict
// instead once the report carries one.
import type { Report } from "@codeheat/engine";

import { formatShare } from "../render/format.js";
import type { TerritoryIndex } from "../territories/territory-index.js";
import { factsOf } from "./facts.js";
import type { VerdictFact } from "./facts.js";
import { leaksOf } from "./leaks.js";

/** `holds`: territories that contain their changes hold most of the work. `unknown`: nothing to judge. */
export type VerdictLevel = "holds" | "mixed" | "strained" | "unknown";

export type Verdict = {
  readonly level: VerdictLevel;
  /** Two or three words naming the level, for a badge next to the sentence. */
  readonly label: string;
  /** One sentence for a reader who has never seen the repository. */
  readonly sentence: string;
  readonly facts: readonly VerdictFact[];
};

/** Share of the change effort in leaking territories below which the design holds. */
const HOLDS_BELOW = 0.2;
/** Share from which the design is under strain; between the two it holds in parts. */
const STRAINED_FROM = 0.5;

const LABELS: Record<VerdictLevel, string> = {
  holds: "Holds up",
  mixed: "Holds in parts",
  strained: "Under strain",
  unknown: "Not enough data",
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

const TREND_CLAUSES = {
  eroding: ", and it is getting worse",
  improving: ", and it is getting better",
  holding: "",
  unknown: "",
} as const;

const trendClause = ({ erosion }: Report): string =>
  TREND_CLAUSES[erosion?.verdict ?? "unknown"];

const leakClause = (share: number): string =>
  `territories holding ${share >= 0.995 ? "all" : formatShare(share)} of the change effort keep reaching into their neighbors`;

const NO_TERRITORIES =
  "This report has no territories, so it cannot say whether the design holds; analyze again with a current codeheat.";

type Wording = {
  readonly share: number;
  readonly trend: string;
  readonly hasTerritories: boolean;
};

const SENTENCES: Record<VerdictLevel, (wording: Wording) => string> = {
  holds: ({ share, trend }) =>
    `Changes stay where they start: territories holding ${formatShare(1 - share)} of the change effort contain them${trend}.`,
  mixed: ({ share, trend }) =>
    `In some places it does not: ${leakClause(share)}${trend}.`,
  strained: ({ share, trend }) =>
    `Not where it matters: ${leakClause(share)}${trend}.`,
  unknown: ({ hasTerritories }) =>
    hasTerritories
      ? "There is not enough history to judge the design yet."
      : NO_TERRITORIES,
};

/**
 * Whether the design holds up to the way the code changes, for the whole
 * repository: the share of the change effort in territories that keep leaking
 * into their neighbors decides the level, an eroding trend lowers it, and the
 * number of leaking territories, the weight of the top places to start, the
 * trend, and the propagation cost are the facts behind it.
 */
export const deriveVerdict = (
  report: Report,
  territories: TerritoryIndex,
): Verdict => {
  const leaks = leaksOf(report, territories);
  const level =
    leaks === null ? "unknown" : withTrend(baseLevel(leaks.heatShare), report);
  return {
    level,
    label: LABELS[level],
    sentence: SENTENCES[level]({
      share: leaks?.heatShare ?? 0,
      trend: trendClause(report),
      hasTerritories: report.territories.nodes.length > 0,
    }),
    facts: factsOf(report, territories, leaks),
  };
};
