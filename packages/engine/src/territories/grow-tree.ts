// Owns growing the territory tree: which parts split, in what order, and at
// which detail each split opens.
import { rootPart } from "./folders.js";
import type { Evidence, Part, TreeNode } from "./part.js";
import { planSplit } from "./plan-split.js";
import type { Split } from "./plan-split.js";

/** Detail levels run from 1 (the first cut) to at most this. */
const MAX_DETAIL = 6;
/** The tree never grows past this many territories, or a 60th of the files if that is more. */
const MIN_TERRITORY_CAP = 60;
const CAP_FILES_PER_TERRITORY = 60;

export type GrownTree = {
  readonly root: TreeNode;
  /** The nodes visible at each detail, from detail 1; every file is in exactly one. */
  readonly details: ReadonlyArray<ReadonlyArray<TreeNode>>;
};

/** A part counts as a territory of its own, loose files included, unlike a bucket of smaller folders. */
const isTerritory = (part: Part): boolean => part.kind !== "more";

const territoriesIn = (parts: ReadonlyArray<Part>): number =>
  parts.filter((part) => isTerritory(part)).length;

type Candidate = {
  readonly part: Part;
  readonly split: Split;
};

/**
 * Every split the tree could make, in the order of their value: the best of
 * the parts that can split now, then the best of what its split opened, and
 * so on.
 */
const rankSplits = (
  rootSplit: Split,
  evidence: Evidence,
  packages: ReadonlySet<string>,
): ReadonlyArray<Candidate> => {
  const waiting: Array<Candidate> = [];
  const ranked: Array<Candidate> = [];
  const offer = (kids: ReadonlyArray<Part>): void => {
    for (const part of kids) {
      const split = planSplit(part, evidence, packages, false);
      if (split !== undefined) {
        waiting.push({ part, split });
      }
    }
  };
  offer(rootSplit.kids);
  while (waiting.length > 0) {
    const best = waiting.reduce(
      (leader, candidate, index) =>
        candidate.split.value > (waiting[leader]?.split.value ?? 0)
          ? index
          : leader,
      0,
    );
    const [picked] = waiting.splice(best, 1);
    if (picked !== undefined) {
      ranked.push(picked);
      offer(picked.split.kids);
    }
  }
  return ranked;
};

/** The territories after 0, 1, 2, … of the ranked splits. */
const territoryCounts = (
  rootSplit: Split,
  ranked: ReadonlyArray<Candidate>,
): ReadonlyArray<number> => {
  const counts = [territoriesIn(rootSplit.kids)];
  for (const { part, split } of ranked) {
    const before = counts.at(-1) ?? 0;
    counts.push(
      before - (isTerritory(part) ? 1 : 0) + territoriesIn(split.kids),
    );
  }
  return counts;
};

/** The index after the last of the ranked splits that open with the one at `begin`: the next ones while the territories stay within `limit`. */
const reach = (
  begin: number,
  limit: number,
  counts: ReadonlyArray<number>,
  splits: number,
): number => {
  let end = begin + 1;
  while (end < splits && (counts[end + 1] ?? 0) <= limit) {
    end += 1;
  }
  return end;
};

/**
 * The detail at which each kept split opens: the splits in rank order are
 * spread over details 2 to 6 so that the territory count grows by about the
 * same factor from one detail to the next.
 */
const levelsOf = (
  kept: ReadonlyArray<Candidate>,
  counts: ReadonlyArray<number>,
): { readonly levels: ReadonlyMap<Part, number>; readonly depth: number } => {
  const depth = Math.min(MAX_DETAIL, kept.length + 1);
  const first = counts[0] ?? 1;
  const last = counts[kept.length] ?? first;
  const levels = new Map<Part, number>();
  let next = 0;
  for (const detail of Array.from({ length: depth - 1 }, (_, at) => at + 2)) {
    const target = first * (last / first) ** ((detail - 1) / (depth - 1));
    const end =
      detail === depth
        ? kept.length
        : reach(next, target + 0.5, counts, kept.length);
    for (const { part } of kept.slice(next, end)) {
      levels.set(part, detail);
    }
    next = Math.max(next, end);
  }
  return { levels, depth };
};

const nodeOf = (part: Part, splits: ReadonlyMap<Part, Split>): TreeNode => {
  const split = splits.get(part);
  return {
    part,
    reason: split?.reason,
    children: split?.kids.map((kid) => nodeOf(kid, splits)) ?? [],
  };
};

const visibleAt = (
  node: TreeNode,
  detail: number,
  levels: ReadonlyMap<Part, number>,
): ReadonlyArray<TreeNode> =>
  node.children.length > 0 && (levels.get(node.part) ?? 1) <= detail
    ? node.children.flatMap((child) => visibleAt(child, detail, levels))
    : [node];

/**
 * Grows the tree over `files` (see `Part.files`): the first cut by packages
 * or top-level folders, then the splits of `planSplit` in the order of their
 * value, kept while the tree holds at most `max(60, files / 60)` territories.
 * A repository too small to split is a single node at detail 1.
 */
export const growTree = (
  files: ReadonlyArray<string>,
  evidence: Evidence,
  packages: ReadonlySet<string>,
): GrownTree => {
  const top = rootPart(files, packages);
  const rootSplit = planSplit(top, evidence, packages, true);
  if (rootSplit === undefined || territoriesIn(rootSplit.kids) === 0) {
    const root = nodeOf(top, new Map());
    return { root, details: [[root]] };
  }
  const ranked = rankSplits(rootSplit, evidence, packages);
  const counts = territoryCounts(rootSplit, ranked);
  const cap = Math.max(
    MIN_TERRITORY_CAP,
    Math.floor(files.length / CAP_FILES_PER_TERRITORY),
  );
  const keep = counts.findLastIndex((count) => count <= cap);
  const kept = ranked.slice(0, Math.max(0, keep));
  const splits = new Map<Part, Split>([
    [top, rootSplit],
    ...kept.map(({ part, split }): [Part, Split] => [part, split]),
  ]);
  const root = nodeOf(top, splits);
  const { levels, depth } = levelsOf(kept, counts);
  return {
    root,
    details: Array.from({ length: depth }, (_, index) =>
      visibleAt(root, index + 1, levels),
    ),
  };
};
