import { breakable, h } from "../render/dom.js";
import { formatCount, formatShare } from "../render/format.js";
import type { Matrix, MatrixRow } from "./matrix-data.js";
import { cellSummary } from "./matrix-summary.js";
import type { SummaryLimits } from "./matrix-summary.js";

const nameView = ({ nameParts }: MatrixRow): HTMLElement =>
  h(
    "span",
    "mx-name",
    ...(nameParts.dir === ""
      ? []
      : [h("span", "mx-dir", ...breakable(nameParts.dir))]),
    h("strong", "", ...breakable(nameParts.base)),
  );

const columnHead = (row: MatrixRow, index: number): HTMLElement => {
  const head = h(
    "th",
    "mx-col",
    String(index + 1),
    h("span", "sr-only", row.name),
  );
  head.scope = "col";
  return head;
};

const rowHead = (row: MatrixRow, index: number): HTMLElement => {
  const head = h(
    "th",
    "mx-row",
    h("span", "mx-num", String(index + 1)),
    nameView(row),
  );
  head.scope = "row";
  return head;
};

/** The text a cell shows: the shared changes of a pair, the containment on the diagonal. */
const cellText = (matrix: Matrix, row: number, column: number): string => {
  if (row === column) {
    const { containment } = matrix.rows[row] ?? { containment: null };
    return containment === null ? "–" : formatShare(containment);
  }
  const cell = matrix.cellAt(row, column);
  return cell === null ? "" : formatCount(cell.sharedChanges);
};

const cellView = (
  matrix: Matrix,
  row: number,
  column: number,
  summary: string,
): HTMLElement => {
  const cell = h("td", "mx-cell", cellText(matrix, row, column));
  const pair = matrix.cellAt(row, column);
  cell.setAttribute("role", "gridcell");
  cell.setAttribute("aria-label", summary);
  cell.tabIndex = -1;
  cell.title = summary;
  cell.dataset["row"] = String(row);
  cell.dataset["column"] = String(column);
  if (row === column) {
    cell.dataset["diagonal"] = String(matrix.rows[row]?.step ?? 0);
  } else if (pair !== null) {
    cell.dataset["level"] = String(pair.level);
    cell.dataset["distant"] = String(pair.distantPairs > 0);
    cell.dataset["hidden"] = String(pair.hiddenPairs > 0);
  }
  return cell;
};

/**
 * The matrix as a table: a numbered column and a named row for every
 * territory, and a cell for every pair, which carries its summary as its
 * accessible name and tooltip. Every cell is out of the tab order; see
 * `moveFocus`.
 */
export const gridOf = (matrix: Matrix, limits: SummaryLimits): HTMLElement => {
  const table = h(
    "table",
    "mx",
    h(
      "thead",
      "",
      h(
        "tr",
        "",
        h("td", "mx-corner", ""),
        ...matrix.rows.map((row, index) => columnHead(row, index)),
      ),
    ),
    h(
      "tbody",
      "",
      ...matrix.rows.map((row, index) =>
        h(
          "tr",
          "",
          rowHead(row, index),
          ...matrix.rows.map((_, column) =>
            cellView(
              matrix,
              index,
              column,
              cellSummary(matrix, index, column, limits),
            ),
          ),
        ),
      ),
    ),
  );
  table.style.setProperty("--mx-n", String(matrix.rows.length));
  table.setAttribute("role", "grid");
  table.setAttribute("aria-label", "Changes shared between territories");
  return table;
};
