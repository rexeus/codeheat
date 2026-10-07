import type { Analysis } from "@codeheat/engine";

import { coChangeAnswer } from "../co-change/co-change-card.js";
import { coChangeOf } from "../co-change/pairs.js";
import { concentrationAnswer } from "../concentration/concentration-card.js";
import { concentrationOf } from "../concentration/concentration.js";
import {
  entryViewsOf,
  noEntriesNote,
  topEntriesCodeHeat,
} from "../entry-points/entry-views.js";
import { placesAnswer } from "../entry-points/places-card.js";
import { byId } from "../render/dom.js";
import { indexTerritories } from "../territories/territory-index.js";
import { describeVerdict } from "../verdict/describe-verdict.js";
import { trendOf } from "../verdict/trend.js";
import { weakStructureAnswer } from "../weak-structure/weak-structure-card.js";
import { weakStructureOf } from "../weak-structure/weak-structure.js";
import {
  CHART_REGION_ID,
  CHART_TITLE_ID,
  renderAnswer,
} from "./answer-card.js";
import type { Answer, RenderedAnswer } from "./answer-card.js";
import { renderHeadline } from "./headline.js";

/** The four answers, in the order the page asks them. */
const answersOf = (
  report: Analysis,
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
      topEntriesCodeHeat(report, territories),
      noEntriesNote(report),
    ),
  ];
};

/** Where the cards stack: below this width a chart below all four cards is out of sight of the card that opened it (the stylesheet's breakpoint). */
const STACKED = "(max-width: 640px)";

/**
 * Shows the chart of `open` in the region below the cards and marks its card
 * expanded, every other one collapsed; `null` hides the region. Where the
 * cards stack, a chart opened by a press scrolls into view and its heading
 * takes focus, since it lies below all four cards.
 */
const showChart = (
  rendered: readonly RenderedAnswer[],
  open: RenderedAnswer | null,
  pressed: boolean,
): void => {
  const region = byId(CHART_REGION_ID, HTMLElement);
  for (const answer of rendered) {
    if (answer.chart !== null) {
      answer.card.setAttribute("aria-expanded", String(answer === open));
    }
  }
  const chart = open?.chart ?? null;
  region.replaceChildren(...(chart ?? []));
  region.hidden = chart === null;
  if (pressed && !region.hidden && window.matchMedia(STACKED).matches) {
    region.scrollIntoView({ block: "start" });
    byId(CHART_TITLE_ID, HTMLElement).focus({ preventScroll: true });
  }
};

/**
 * Renders the first view the page template provides: the verdict and the
 * trend beside the question, and the four answer cards. A card with an
 * answer opens its chart in the one region after the cards and closes the
 * one open before; a second press closes it. The first card with a chart
 * starts open. A territory in the chart of the first card shows its files in
 * the map through `showTerritory`.
 */
export const mountAnswers = (
  report: Analysis,
  showTerritory: (id: string) => void,
): void => {
  renderHeadline(
    {
      badge: byId("verdict", HTMLElement),
      trend: byId("trend", HTMLElement),
      reason: byId("verdict-reason", HTMLElement),
    },
    describeVerdict(report),
    trendOf(report),
  );
  const rendered = answersOf(report, showTerritory).map((answer, index) =>
    renderAnswer(index + 1, answer),
  );
  byId("answer-cards", HTMLElement).replaceChildren(
    ...rendered.map(({ card }) => card),
  );
  for (const answer of rendered.filter(({ chart }) => chart !== null)) {
    answer.card.addEventListener("click", () => {
      const isOpen = answer.card.getAttribute("aria-expanded") === "true";
      showChart(rendered, isOpen ? null : answer, true);
    });
  }
  showChart(
    rendered,
    rendered.find(({ chart }) => chart !== null) ?? null,
    false,
  );
};
