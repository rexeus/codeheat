// Owns what "What changes together" says when it has little or nothing to
// show: one sentence instead of a matrix without pairs or a row of empty cards.
import { formatCount } from "../render/format.js";
import type { Matrix } from "./matrix-data.js";

/** What decides what a section without content says. */
export type EmptyLimits = {
  /** Fewest counted changes a territory needs to be compared with another. */
  readonly minModuleCommits: number;
  /** Fewest folders apart that make two files of one module far apart. */
  readonly minLocalDistance: number;
};

/** How many entries each of the lists under the matrix has. */
export type ListSizes = {
  readonly cliques: number;
  readonly pairs: number;
  readonly families: number;
};

const NO_TERRITORIES =
  "This report has no territories, so there is no matrix of how they change together; analyze again with a current codeheat.";

/** What far apart means for a pair of files, in words. */
export const farApart = ({ minLocalDistance }: EmptyLimits): string =>
  `in different modules, or at least ${formatCount(minLocalDistance)} ${minLocalDistance === 1 ? "folder" : "folders"} apart within one`;

/** Where hidden coupling between files that are not far apart is to be found. */
const NEARBY_HIDDEN =
  'Hidden coupling between nearby files is not listed here; select a file in the map to see what changes with it, marked "no import".';

/** What the pairs card says when no pair lies far apart. */
export const noDistantPairs = (limits: EmptyLimits): string =>
  `No coupled pair lies far apart (${farApart(limits)}). ${NEARBY_HIDDEN}`;

/**
 * One sentence in place of a matrix that has nothing to compare: no
 * territories, none with the changes it takes, or only one. `null` when the
 * matrix compares at least two territories.
 */
export const matrixNote = (
  matrix: Matrix,
  { minModuleCommits }: EmptyLimits,
): string | null => {
  if (matrix.total === 0) {
    return NO_TERRITORIES;
  }
  const [only] = matrix.rows;
  if (only !== undefined && matrix.rows.length === 1) {
    return `Only ${only.name} has the ${formatCount(minModuleCommits)} changes it takes to compare it with another, so there is nothing to set it against.`;
  }
  return matrix.rows.length === 0
    ? `No territory has the ${formatCount(minModuleCommits)} changes it takes to compare it with another.`
    : null;
};

/**
 * One sentence for the whole section when it has neither a matrix nor any
 * entry in its lists, so that it does not show a row of cards that all say
 * "none". `null` when anything is left to show.
 */
export const collapsedNote = (
  note: string | null,
  lists: ListSizes,
  changes: number,
): string | null => {
  const empty = lists.cliques + lists.pairs + lists.families === 0;
  if (note === null || !empty) {
    return null;
  }
  return changes === 0
    ? "No counted changes in this window, so nothing changes together."
    : `${note} No group of territories, no coupled file pair far apart and no family of copies outside test code changes together either.`;
};

/**
 * One sentence for the lists under a matrix that has none of them, with what
 * far apart means; `null` when any list has an entry.
 */
export const emptyListsNote = (
  lists: ListSizes,
  limits: EmptyLimits,
): string | null =>
  lists.cliques + lists.pairs + lists.families > 0
    ? null
    : `No group of three or more territories changes as one unit, no coupled file pair lies far apart (${farApart(limits)}), and no family of copies outside test code changes in lockstep. ${NEARBY_HIDDEN}`;
