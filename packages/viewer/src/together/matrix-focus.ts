import type { Matrix } from "./matrix-data.js";

const HINT =
  "Move to a cell with the arrow keys or the pointer to read it. A number is how many changes touched both territories; the diagonal is the share of a territory's changes that stay inside it.";

type Place = readonly [row: number, column: number];

/** Moves among the cells with the arrow keys, Home, and End; returns the cell to focus, or `null` for another key. */
const moveFrom = (
  key: string,
  [row, column]: Place,
  size: number,
): Place | null => {
  const last = size - 1;
  const moves: Record<string, Place> = {
    ArrowUp: [Math.max(0, row - 1), column],
    ArrowDown: [Math.min(last, row + 1), column],
    ArrowLeft: [row, Math.max(0, column - 1)],
    ArrowRight: [row, Math.min(last, column + 1)],
    Home: [row, 0],
    End: [row, last],
  };
  return moves[key] ?? null;
};

const cellOf = (event: Event): HTMLElement | null => {
  const cell =
    event.target instanceof Element ? event.target.closest(".mx-cell") : null;
  return cell instanceof HTMLElement ? cell : null;
};

const placeOf = (cell: HTMLElement): Place => [
  Number(cell.dataset["row"]),
  Number(cell.dataset["column"]),
];

/** The text under the matrix before a cell is read. */
export const matrixHint = (): string => HINT;

/** Marks the row and column heads of a cell, or none. */
const headMarker = (table: HTMLElement): ((place: Place | null) => void) => {
  const rows = [...table.querySelectorAll<HTMLElement>(".mx-row")];
  const columns = [...table.querySelectorAll<HTMLElement>(".mx-col")];
  return (place) => {
    for (const [index, head] of rows.entries()) {
      head.dataset["active"] = String(index === place?.[0]);
    }
    for (const [index, head] of columns.entries()) {
      head.dataset["active"] = String(index === place?.[1]);
    }
  };
};

/**
 * Makes `table` a grid with one tab stop: the arrow keys, Home, and End move
 * among its cells, and the cell under the pointer or the focus is read out
 * in `summary` and marked on its row and column heads.
 */
export const moveFocus = (
  table: HTMLElement,
  summary: HTMLElement,
  matrix: Matrix,
): void => {
  const size = matrix.rows.length;
  const cells = [...table.querySelectorAll<HTMLElement>(".mx-cell")];
  const cellAt = ([row, column]: Place): HTMLElement | undefined =>
    cells[row * size + column];
  const mark = headMarker(table);
  let active: Place = [0, 0];
  const read = (place: Place | null): void => {
    summary.textContent =
      place === null ? HINT : (cellAt(place)?.title ?? HINT);
    mark(place);
  };
  cellAt(active)?.setAttribute("tabindex", "0");

  table.addEventListener("focusin", (event) => {
    const cell = cellOf(event);
    if (cell !== null) {
      active = placeOf(cell);
      read(active);
    }
  });
  table.addEventListener("focusout", () => {
    if (!table.matches(":hover")) {
      read(null);
    }
  });
  table.addEventListener("pointerover", (event) => {
    const cell = cellOf(event);
    if (cell !== null) {
      read(placeOf(cell));
    }
  });
  table.addEventListener("pointerleave", () => {
    read(table.contains(document.activeElement) ? active : null);
  });
  table.addEventListener("keydown", (event) => {
    const next = moveFrom(event.key, active, size);
    if (next === null) {
      return;
    }
    event.preventDefault();
    cellAt(active)?.setAttribute("tabindex", "-1");
    active = next;
    const cell = cellAt(next);
    cell?.setAttribute("tabindex", "0");
    cell?.focus();
  });
};
