// Owns what a matrix cell says in words, for the summary line under the
// matrix, a cell's accessible name, and its tooltip.
import { formatCount, formatShare } from "../render/format.js";
import type { Matrix, MatrixCell, MatrixRow } from "./matrix-data.js";

/** The limit of the report that says why a pair is not listed. */
export type SummaryLimits = {
  readonly minSharedCommits: number;
};

const times = (count: number): string =>
  count === 1 ? "once" : `${formatCount(count)} times`;

const pairs = (count: number): string =>
  `${formatCount(count)} coupled file ${count === 1 ? "pair" : "pairs"}`;

/** What the coupled file pairs between two territories say about their imports. */
const importsNote = ({ distantPairs, hiddenPairs }: MatrixCell): string => {
  if (distantPairs === 0) {
    return "";
  }
  if (hiddenPairs === 0) {
    return `; ${pairs(distantPairs)} between them, each linked by an import or not readable`;
  }
  return hiddenPairs === distantPairs
    ? `; no import between them (${pairs(distantPairs)})`
    : `; no import between ${formatCount(hiddenPairs)} of ${pairs(distantPairs)}`;
};

const together = (a: MatrixRow, b: MatrixRow, cell: MatrixCell): string =>
  `${a.name} and ${b.name} changed together ${times(cell.sharedChanges)}${importsNote(cell)}.`;

const diagonal = (row: MatrixRow): string =>
  row.containment === null
    ? `${row.name} is not judged: ${row.noData ?? "no data"}.`
    : `${row.name}: ${formatShare(row.containment)} of its ${formatCount(row.changes)} changes stay inside it.`;

const notListed = (
  a: MatrixRow,
  b: MatrixRow,
  { minSharedCommits }: SummaryLimits,
): string =>
  `${a.name} and ${b.name} shared fewer than ${formatCount(minSharedCommits)} changes.`;

/**
 * One cell in a sentence. The diagonal says how much of the territory's
 * changes stay inside; a pair says how often the two changed together and
 * whether an import links the files between them; a pair the report does not
 * list says it shared too few changes.
 */
export const cellSummary = (
  matrix: Matrix,
  row: number,
  column: number,
  limits: SummaryLimits,
): string => {
  const a = matrix.rows[row];
  const b = matrix.rows[column];
  if (a === undefined || b === undefined) {
    return "";
  }
  if (row === column) {
    return diagonal(a);
  }
  const cell = matrix.cellAt(row, column);
  return cell === null ? notListed(a, b, limits) : together(a, b, cell);
};
