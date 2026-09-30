// Owns column alignment for terminal tables, measured before styling is applied.
import type { Style } from "./style.js";

export type Cell = {
  readonly text: string;
  /** Styles the padded text; alignment is computed from the plain `text`. */
  readonly paint?: (text: string) => string;
};

export type Column = {
  readonly header: string;
  readonly align: "left" | "right";
};

/** A cell with no styling. */
export const plain = (text: string): Cell => ({ text });

const padCell = (
  text: string,
  width: number,
  align: Column["align"],
): string => (align === "right" ? text.padStart(width) : text.padEnd(width));

/**
 * Renders a dimmed header row and one line per row, columns separated by two
 * spaces. The last column is never padded, so lines carry no trailing blanks.
 */
export const renderTable = (
  columns: ReadonlyArray<Column>,
  rows: ReadonlyArray<ReadonlyArray<Cell>>,
  style: Style,
): ReadonlyArray<string> => {
  const widths = columns.map((column, index) =>
    Math.max(
      column.header.length,
      ...rows.map((row) => row[index]?.text.length ?? 0),
    ),
  );
  const last = columns.length - 1;
  const line = (cells: ReadonlyArray<Cell>): string =>
    columns
      .map((column, index) => {
        const cell = cells[index] ?? plain("");
        const width =
          index === last && column.align === "left" ? 0 : (widths[index] ?? 0);
        const padded = padCell(cell.text, width, column.align);
        return cell.paint === undefined ? padded : cell.paint(padded);
      })
      .join("  ");
  const header = line(
    columns.map((column) => ({ text: column.header, paint: style.dim })),
  );
  return [header, ...rows.map((row) => line(row))];
};
