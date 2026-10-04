import { h } from "../render/dom.js";
import type { Matrix } from "./matrix-data.js";
import { moveFocus, matrixHint } from "./matrix-focus.js";
import { gridOf } from "./matrix-grid.js";
import { capNote, legendOf, notComparedNote } from "./matrix-legend.js";
import type { SummaryLimits } from "./matrix-summary.js";

/**
 * Draws the territory matrix into `target`: a grid of every pair of territories,
 * symmetric about the diagonal, with one tab stop (the arrow keys move
 * between cells) and a summary line that says in words what the focused or
 * hovered cell means.
 */
export const renderMatrix = (
  target: HTMLElement,
  matrix: Matrix,
  limits: SummaryLimits,
): void => {
  const summary = h("p", "mx-summary", matrixHint());
  const notCompared = notComparedNote(matrix);
  const table = gridOf(matrix, limits);
  moveFocus(table, summary, matrix);
  target.replaceChildren(
    h(
      "header",
      "tg-head",
      h("h3", "", "Changes shared between territories"),
      h("p", "tg-sub", capNote(matrix)),
    ),
    legendOf(matrix),
    summary,
    h("div", "mx-scroll", table),
    h("p", "mx-hint", "Scroll sideways to see every column."),
    ...(notCompared === null ? [] : [h("p", "tg-note", notCompared)]),
  );
};
