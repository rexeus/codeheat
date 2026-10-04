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

/** How many territories the matrix compares, and of how many. */
export const capNote = (matrix: Matrix): string => {
  const capped =
    matrix.total > matrix.considered
      ? ` (the ${formatCount(matrix.considered)} hottest of ${formatCount(matrix.total)} were considered)`
      : "";
  return `${formatCount(matrix.rows.length)} territories, hottest first${capped}; buckets and test code are left out.`;
};

/** The hottest territories the matrix leaves out for having too few changes to compare, in one sentence; `null` when it leaves none out. */
export const notComparedNote = (matrix: Matrix): string | null =>
  matrix.notCompared.length === 0
    ? null
    : `Not compared, too few changes: ${matrix.notCompared.map(({ name }) => name).join(", ")}.`;
