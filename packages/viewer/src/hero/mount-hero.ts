import { renderFitLegend, renderFitList } from "../fit-map/fit-legend.js";
import { renderFitMap } from "../fit-map/fit-map-view.js";
import { byId, h } from "../render/dom.js";
import type { HeroData } from "./hero-data.js";
import { renderTopThree } from "./top-three.js";
import { renderVerdict } from "./verdict-view.js";

/** What the map area says when there is nothing to draw. */
const NO_TERRITORIES =
  "This report has no territories, so there is no map of its parts; analyze again with a current codeheat.";

/**
 * Fills the hero the page template provides: the verdict, the fit map with
 * its legend and territory list, and the top places to start. Without
 * territories the map area says so and the rest of the hero still works.
 */
export const mountHero = ({
  verdict,
  tiles,
  entries,
  noEntries,
}: HeroData): void => {
  renderVerdict(byId("verdict", HTMLElement), verdict);
  renderTopThree(byId("top-three", HTMLElement), entries, noEntries);
  const map = byId("fit-map", HTMLElement);
  const figure = byId("fit-figure", HTMLElement);
  if (tiles.length === 0) {
    figure.dataset["empty"] = "true";
    map.replaceChildren(h("p", "fit-empty", NO_TERRITORIES));
    return;
  }
  renderFitMap(map, tiles);
  renderFitLegend(byId("fit-legend", HTMLElement));
  renderFitList(byId("fit-list", HTMLDetailsElement), tiles);
};
