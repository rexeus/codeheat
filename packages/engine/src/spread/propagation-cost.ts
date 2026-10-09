// Owns the propagation cost: how much of the code a change to one file drags
// along, read from the co-change graph of the files.
import { MIN_SHARED_COMMITS } from "../coupling/coupling.js";
import type { Coupling } from "../model/analysis.js";
import type { PropagationCost } from "../model/change-radius.js";
import { roundReported } from "../model/precision.js";

/** Longest chain of couplings a change is followed along: a full closure saturates on dense graphs and says nothing. */
export const PROPAGATION_DEPTH = 3;

/** A file that may take part in the co-change graph. */
export type ReachFile = {
  readonly path: string;
  /** Counted changes of the window that touched it: large changes are left out, as they are for coupling. */
  readonly changes: number;
};

/** Both endpoints of every edge among `index`, as indices into the file list. */
const adjacencyOf = (
  index: ReadonlyMap<string, number>,
  couplings: ReadonlyArray<Coupling>,
): ReadonlyArray<ReadonlyArray<number>> => {
  const adjacent = Array.from(index, () => new Array<number>());
  for (const { a, b } of couplings) {
    const from = index.get(a);
    const to = index.get(b);
    if (from !== undefined && to !== undefined) {
      adjacent[from]?.push(to);
      adjacent[to]?.push(from);
    }
  }
  return adjacent;
};

/** The files not yet `visited` that are one coupling away from `frontier`, marked as visited by `start`. */
const expand = (
  frontier: ReadonlyArray<number>,
  adjacent: ReadonlyArray<ReadonlyArray<number>>,
  visited: Int32Array,
  start: number,
): Array<number> => {
  const next: Array<number> = [];
  for (const file of frontier) {
    for (const neighbor of adjacent[file] ?? []) {
      if (visited[neighbor] !== start) {
        visited[neighbor] = start;
        next.push(neighbor);
      }
    }
  }
  return next;
};

/** How many other files a change to `start` reaches within `depth` couplings; `visited` holds scratch stamps, one per file. */
const reachFrom = (
  start: number,
  adjacent: ReadonlyArray<ReadonlyArray<number>>,
  depth: number,
  visited: Int32Array,
): number => {
  visited[start] = start;
  let frontier = [start];
  let reached = 0;
  for (let hop = 0; hop < depth && frontier.length > 0; hop += 1) {
    frontier = expand(frontier, adjacent, visited, start);
    reached += frontier.length;
  }
  return reached;
};

/**
 * The propagation cost of the co-change graph (MacCormack, Rusnak, and
 * Baldwin): a file reaches another when a chain of at most `depth` of the
 * reported `couplings` joins them, and the cost is the mean over the files of
 * the share of the other files they reach.
 *
 * The files are those of `files` that took part in at least
 * `MIN_SHARED_COMMITS` counted changes, the fewest a file needs to be coupled
 * at all: a file with less history says nothing, and counting it would make
 * the cost a measure of how much code rarely changes. The result is null when
 * fewer than two files qualify.
 */
export const propagationCost = (
  files: Iterable<ReachFile>,
  couplings: ReadonlyArray<Coupling>,
  depth: number = PROPAGATION_DEPTH,
): PropagationCost | null => {
  const index = new Map<string, number>();
  for (const { path, changes } of files) {
    if (changes >= MIN_SHARED_COMMITS) {
      index.set(path, index.size);
    }
  }
  if (index.size < 2) {
    return null;
  }
  const adjacent = adjacencyOf(index, couplings);
  const visited = new Int32Array(index.size).fill(-1);
  let shares = 0;
  for (let start = 0; start < index.size; start += 1) {
    shares += reachFrom(start, adjacent, depth, visited) / (index.size - 1);
  }
  return { cost: roundReported(shares / index.size), files: index.size };
};
