import type { Report } from "@codeheat/engine";

import { coChangeAnswer } from "../co-change/co-change-card.js";
import { coChangeOf } from "../co-change/pairs.js";
import { concentrationAnswer } from "../concentration/concentration-card.js";
import { concentrationOf } from "../concentration/concentration.js";
import {
  entryViewsOf,
  noEntriesNote,
  topEntriesHeat,
} from "../entry-points/entry-views.js";
import { placesAnswer } from "../entry-points/places-card.js";
import { byId } from "../render/dom.js";
import { indexTerritories } from "../territories/territory-index.js";
import { deriveVerdict } from "../verdict/derive-verdict.js";
import { trendOf } from "../verdict/trend.js";
import { weakStructureAnswer } from "../weak-structure/weak-structure-card.js";
import { weakStructureOf } from "../weak-structure/weak-structure.js";
import { renderAnswer } from "./answer-card.js";
import type { Answer, RenderedAnswer } from "./answer-card.js";
import { renderHeadline } from "./headline.js";

/** The four answers, in the order the page asks them. */
const answersOf = (
  report: Report,
  showTerritory: (id: string) => void,
): Answer[] => {
  const territories = indexTerritories(report.territories);
  return [
    concentrationAnswer(concentrationOf(report, territories), showTerritory),
    coChangeAnswer(
      coChangeOf(report, territories),
      report.thresholds.maxEntryContainment,
    ),
    weakStructureAnswer(weakStructureOf(report, territories)),
    placesAnswer(
      entryViewsOf(report, territories),
      topEntriesHeat(report, territories),
      noEntriesNote(report),
    ),
  ];
};

/** Opens the chart of `open` and closes every other one; `null` closes all. */
const showChart = (
  rendered: readonly RenderedAnswer[],
  open: RenderedAnswer | null,
): void => {
  for (const answer of rendered) {
    if (answer.chart !== null) {
      const expanded = answer === open;
      answer.card.setAttribute("aria-expanded", String(expanded));
      answer.chart.hidden = !expanded;
    }
  }
};

/**
 * Renders the first view the page template provides: the verdict and the
 * trend beside the question, and the four answer cards. A card with an
 * answer opens its chart below the cards and closes the one open before; a
 * second press closes it. The first card with a chart starts open. A
 * territory in the chart of the first card shows its files in the map
 * through `showTerritory`.
 */
export const mountAnswers = (
  report: Report,
  showTerritory: (id: string) => void,
): void => {
  renderHeadline(
    {
      badge: byId("verdict", HTMLElement),
      trend: byId("trend", HTMLElement),
      reason: byId("verdict-reason", HTMLElement),
    },
    deriveVerdict(report, indexTerritories(report.territories)),
    trendOf(report),
  );
  const rendered = answersOf(report, showTerritory).map((answer, index) =>
    renderAnswer(index + 1, answer),
  );
  byId("answer-cards", HTMLElement).replaceChildren(
    ...rendered.flatMap(({ card, chart }) =>
      chart === null ? [card] : [card, chart],
    ),
  );
  for (const answer of rendered.filter(({ chart }) => chart !== null)) {
    answer.card.addEventListener("click", () => {
      const isOpen = answer.card.getAttribute("aria-expanded") === "true";
      showChart(rendered, isOpen ? null : answer);
    });
  }
  showChart(rendered, rendered.find(({ chart }) => chart !== null) ?? null);
};
