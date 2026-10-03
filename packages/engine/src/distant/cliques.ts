// Owns finding cliques: groups of modules that almost always change together.
import { Order } from "effect";

import { MIN_SHARED_COMMITS } from "../coupling/coupling.js";
import type { Clique } from "../report/clique.js";
import { roundReported } from "../report/precision.js";
import { sharedShare } from "./module-co-change.js";
import type { ModuleCoChange } from "./module-co-change.js";

/** Smallest share of the smaller module's commits that every pair of a clique shares. */
export const MIN_CLIQUE_SHARE = 0.3;

/** Fewest modules in a clique: two modules that change together are a pair, not a group. */
const MIN_CLIQUE_SIZE = 3;

/** The report keeps this many cliques, those whose members changed together in the most commits first. */
const MAX_CLIQUES = 50;

type Adjacency = ReadonlyMap<string, ReadonlySet<string>>;

/** Links two modules that share enough commits and a large enough share of the smaller one's. */
const linkedModules = (coChange: ModuleCoChange): Adjacency => {
  const linked = new Map<string, Set<string>>();
  const link = (from: string, to: string): void => {
    linked.set(from, (linked.get(from) ?? new Set<string>()).add(to));
  };
  for (const [low, partners] of coChange.shared) {
    for (const [high, sharedCommits] of partners) {
      if (
        sharedCommits >= MIN_SHARED_COMMITS &&
        sharedShare(coChange, low, high) >= MIN_CLIQUE_SHARE
      ) {
        link(low, high);
        link(high, low);
      }
    }
  }
  return linked;
};

const intersection = (
  a: ReadonlySet<string>,
  b: ReadonlySet<string>,
): Set<string> => new Set([...a].filter((path) => b.has(path)));

/**
 * Bron-Kerbosch with pivoting: every maximal clique of `adjacency` that extends
 * `members` with candidates from `candidates`, none of which is in `excluded`.
 */
const extend = (
  adjacency: Adjacency,
  members: ReadonlyArray<string>,
  candidates: Set<string>,
  excluded: Set<string>,
): ReadonlyArray<ReadonlyArray<string>> => {
  if (candidates.size === 0) {
    return excluded.size === 0 ? [members] : [];
  }
  const pivot = [...candidates, ...excluded].reduce((best, path) =>
    intersection(candidates, adjacency.get(path) ?? new Set()).size >
    intersection(candidates, adjacency.get(best) ?? new Set()).size
      ? path
      : best,
  );
  const skipped = adjacency.get(pivot) ?? new Set<string>();
  const found: Array<ReadonlyArray<string>> = [];
  for (const path of [...candidates].filter((each) => !skipped.has(each))) {
    const neighbours = adjacency.get(path) ?? new Set<string>();
    found.push(
      ...extend(
        adjacency,
        [...members, path],
        intersection(candidates, neighbours),
        intersection(excluded, neighbours),
      ),
    );
    candidates.delete(path);
    excluded.add(path);
  }
  return found;
};

const percentOf = (share: number): number => Math.round(share * 100);

const reasonFor = (
  size: number,
  weakestShare: number,
  sharedCommits: number,
): string =>
  `${size} modules of which every pair shares at least ${percentOf(weakestShare)}% of the smaller one's commits; ${sharedCommits} ${sharedCommits === 1 ? "commit touched" : "commits touched"} all of them`;

const toClique = (
  members: ReadonlyArray<string>,
  coChange: ModuleCoChange,
  touched: ReadonlyArray<ReadonlySet<string>>,
): Clique => {
  const modules = members.toSorted((a, b) => Order.String(a, b));
  const weakest = Math.min(
    ...modules.flatMap((a, index) =>
      modules.slice(index + 1).map((b) => sharedShare(coChange, a, b)),
    ),
  );
  const sharedCommits = touched.filter((commit) =>
    modules.every((path) => commit.has(path)),
  ).length;
  return {
    modules,
    sharedCommits,
    weakestShare: roundReported(weakest),
    reason: reasonFor(modules.length, weakest, sharedCommits),
  };
};

const byUnity = (a: Clique, b: Clique): number =>
  b.sharedCommits - a.sharedCommits ||
  b.weakestShare - a.weakestShare ||
  b.modules.length - a.modules.length ||
  Order.String(a.modules.join("\n"), b.modules.join("\n"));

/**
 * The cliques among the ranked modules of `coChange`: maximal groups of at
 * least three of which every pair shares at least `MIN_CLIQUE_SHARE` of the
 * smaller module's counted commits and at least `MIN_SHARED_COMMITS` commits,
 * and of which at least `MIN_SHARED_COMMITS` commits touched every member
 * (pairs that met only in different commits are no unit of change).
 * `touched` lists the modules each counted commit touched. The `MAX_CLIQUES`
 * whose members changed
 * together in the most commits come first, then the higher weakest share,
 * more members, and path.
 */
export const findCliques = (
  coChange: ModuleCoChange,
  touched: ReadonlyArray<ReadonlySet<string>>,
): ReadonlyArray<Clique> => {
  const adjacency = linkedModules(coChange);
  return extend(adjacency, [], new Set(adjacency.keys()), new Set())
    .filter((members) => members.length >= MIN_CLIQUE_SIZE)
    .map((members) => toClique(members, coChange, touched))
    .filter(({ sharedCommits }) => sharedCommits >= MIN_SHARED_COMMITS)
    .toSorted(byUnity)
    .slice(0, MAX_CLIQUES);
};
