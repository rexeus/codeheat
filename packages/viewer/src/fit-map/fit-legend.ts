import { COHESION_STEP_COUNT } from "../color/cohesion-scale.js";
import { h } from "../render/dom.js";
import { formatShare } from "../render/format.js";
import { rankBadge } from "../render/rank-badge.js";
import type { FitTile } from "./fit-tiles.js";

const swatch = (step: number): HTMLElement => {
  const element = h("span", "fit-swatch", "");
  element.dataset["fit"] = String(step);
  return element;
};

/** A sample of the outline the top three places to start draw around their tile. */
const outlineSample = (): HTMLElement => h("span", "fit-outline-sample", "");

/** Explains area, color, and markers of the fit map, and what the change effort is. */
export const renderFitLegend = (target: HTMLElement): void => {
  target.replaceChildren(
    h(
      "span",
      "legend-item",
      h("span", "muted", "Area"),
      h("strong", "", "share of the change effort"),
      h(
        "span",
        "muted",
        "(square-root scaled, so small territories stay visible)",
      ),
    ),
    h(
      "span",
      "legend-item",
      h("span", "muted", "Color"),
      h("strong", "", "share of its changes that stay inside"),
      h("span", "muted", "0%"),
      ...Array.from({ length: COHESION_STEP_COUNT - 1 }, (_, step) =>
        swatch(step + 1),
      ),
      h("span", "muted", "100%"),
    ),
    h(
      "span",
      "legend-item",
      swatch(0),
      h("span", "muted", "not judged (the tile says why)"),
    ),
    h(
      "span",
      "legend-item",
      rankBadge(1, null),
      h("strong", "", "rank in Where to start"),
      h("span", "muted", "(+2: two more places to start here)"),
    ),
    h(
      "span",
      "legend-item",
      outlineSample(),
      h("span", "muted", "one of the top three"),
    ),
    h(
      "p",
      "fit-note",
      "Change effort is how often a file changed, weighted by its size and complexity; a territory's share is its files' part of the repository's total.",
    ),
  );
};

const rowOf = (tile: FitTile): HTMLElement =>
  h(
    "li",
    "fit-row",
    h("strong", "fit-row-name", tile.name),
    h(
      "span",
      "fit-row-numbers",
      tile.containment === null
        ? (tile.noData ?? "")
        : `${formatShare(tile.containment)} of its changes stay inside`,
      ` · ${formatShare(tile.heatShare)} of the effort`,
    ),
    h("span", "fit-row-desc", tile.description),
  );

/** The full list of territories with what each is, for the ones the map is too small to label. */
export const renderFitList = (
  target: HTMLElement,
  tiles: readonly FitTile[],
): void => {
  target.replaceChildren(
    h("summary", "", `All ${tiles.length} territories, with what each is`),
    h("ul", "fit-rows", ...tiles.map((tile) => rowOf(tile))),
  );
};
