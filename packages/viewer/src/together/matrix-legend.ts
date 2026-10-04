import { COHESION_STEP_COUNT } from "../color/cohesion-scale.js";
import { h } from "../render/dom.js";
import { formatCount } from "../render/format.js";
import { MATRIX_LEVELS } from "./matrix-data.js";
import type { Matrix } from "./matrix-data.js";

const legendSwatch = (attributes: Record<string, string>): HTMLElement => {
  const swatch = h("span", "mx-swatch", "");
  for (const [name, value] of Object.entries(attributes)) {
    swatch.dataset[name] = value;
  }
  return swatch;
};

/** What the cells of the matrix mean: their color, the diagonal, and the two marks. */
export const legendOf = (matrix: Matrix): HTMLElement =>
  h(
    "div",
    "mx-legend",
    h(
      "span",
      "legend-item",
      h("span", "muted", "Cell"),
      h("strong", "", "changes that touched both"),
      h("span", "muted", "few"),
      ...Array.from({ length: MATRIX_LEVELS }, (_, step) =>
        legendSwatch({ level: String(step + 1) }),
      ),
      h("span", "muted", `most (${formatCount(matrix.maxShared)})`),
    ),
    h(
      "span",
      "legend-item",
      legendSwatch({ diagonal: String(COHESION_STEP_COUNT - 2) }),
      h("span", "muted", "diagonal: share of its changes that stay inside"),
    ),
    h(
      "span",
      "legend-item",
      legendSwatch({ diagonal: "0" }),
      h("span", "muted", "not compared: too few changes"),
    ),
    h(
      "span",
      "legend-item",
      legendSwatch({ level: "3", distant: "true" }),
      h("span", "muted", "coupled files cross this boundary"),
    ),
    h(
      "span",
      "legend-item",
      legendSwatch({ level: "3", distant: "true", hidden: "true" }),
      h("span", "muted", "dashed: some of them have no import between them"),
    ),
  );

/** How many territories the matrix covers. */
export const capNote = (matrix: Matrix): string =>
  matrix.total > matrix.rows.length
    ? `The ${formatCount(matrix.rows.length)} hottest of ${formatCount(matrix.total)} territories, hottest first; buckets and test code are left out.`
    : `All ${formatCount(matrix.rows.length)} territories, hottest first; buckets and test code are left out.`;
