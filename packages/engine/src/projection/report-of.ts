// Owns projecting the analysis onto report v2, the document agents and the
// terminal read. Pure: the analysis holds everything the report says.
import type { Analysis } from "../model/analysis.js";
import type { Report } from "../report/report.js";
import { answerOf } from "./answer-of.js";
import { areasOf } from "./areas-of.js";
import { basisOf } from "./basis-of.js";
import { hotspotsOf, hottestFiles } from "./hotspots-of.js";
import { dayOf } from "./units.js";

/** The window of `analysis` in days, with the changes the numbers count. */
const windowOf = ({ window }: Pick<Analysis, "window">): Report["window"] => ({
  since: dayOf(window.since),
  until: dayOf(window.until),
  changes: window.couplingCommits,
  lastCommitAt:
    window.lastCommitAt === null ? null : dayOf(window.lastCommitAt),
});

/**
 * Report v2 of `analysis`: the answer, the areas it judges and those that
 * hold the change effort, the hottest production files, and the basis. Every
 * area the report names is a listed area.
 */
export const reportOf = (analysis: Analysis): Report => {
  const hottest = hottestFiles(analysis);
  const { areas, rest } = areasOf(
    analysis,
    new Set(hottest.flatMap(({ area }) => area ?? [])),
  );
  const paths = new Map(
    analysis.territories.nodes.map(({ id, path }) => [id, path]),
  );
  return {
    schemaVersion: 2,
    repository: {
      name: analysis.repository.name,
      head: analysis.repository.head,
      analyzedAt: analysis.generatedAt,
    },
    window: windowOf(analysis),
    answer: answerOf(analysis, rest.heat),
    areas,
    hotspots: hotspotsOf(hottest, (id) => paths.get(id) ?? id),
    basis: basisOf(analysis, rest),
  };
};
