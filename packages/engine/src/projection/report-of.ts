// Owns projecting the analysis onto report v2, the document agents and the
// terminal read. Pure: the analysis holds everything the report says.
import type { Analysis } from "../model/analysis.js";
import type { Report } from "../report/report.js";
import { answerOf } from "./answer-of.js";
import { basisOf } from "./basis-of.js";
import { dayOf } from "./units.js";

/** The window of `analysis` in days, with the changes the numbers count. */
const windowOf = ({ window }: Pick<Analysis, "window">): Report["window"] => ({
  since: dayOf(window.since),
  until: dayOf(window.until),
  changes: window.couplingCommits,
  lastCommitAt:
    window.lastCommitAt === null ? null : dayOf(window.lastCommitAt),
});

/** Report v2 of `analysis`: the repository, the window, the answer, and its basis. */
export const reportOf = (analysis: Analysis): Report => ({
  schemaVersion: 2,
  repository: {
    name: analysis.repository.name,
    head: analysis.repository.head,
    analyzedAt: analysis.generatedAt,
  },
  window: windowOf(analysis),
  answer: answerOf(analysis),
  basis: basisOf(analysis),
});
