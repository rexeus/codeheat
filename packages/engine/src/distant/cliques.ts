// Owns finding cliques: groups of modules that almost always change together.
import { Order } from "effect";

import { MIN_SHARED_COMMITS } from "../coupling/coupling.js";
import type { Clique } from "../model/clique.js";
import { roundReported } from "../model/precision.js";
import { distinctGroups } from "./distinct-groups.js";
import { sharedShare } from "./module-co-change.js";
import type { ModuleCoChange } from "./module-co-change.js";
import { supportedSubgroups } from "./supported-groups.js";

/** Smallest share of the smaller module's changes that every pair of a clique shares. */
export const MIN_CLIQUE_SHARE = 0.3;

/** Fewest modules in a clique: two modules that change together are a pair, not a group. */
const MIN_CLIQUE_SIZE = 3;

/** The report keeps this many cliques, those whose members changed together in the most changes first. */
const MAX_CLIQUES = 50;

/** Maximal groups of the module pair graph that are searched for cliques, those with the strongest weakest pair first. */
const MAX_SEARCHED_GROUPS = 1000;

/** Maximal groups enumerated at all; a graph of many modules in pairs that never change together has exponentially many. */
const MAX_ENUMERATED_GROUPS = 20000;

type Adjacency = ReadonlyMap<string, ReadonlySet<string>>;

/** Links two modules that share enough changes and a large enough share of the smaller one's. */
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
 * Bron-Kerbosch with pivoting: pushes into `search.found` every maximal clique of
 * `search.adjacency` that extends `members` with candidates from `candidates`, none of
 * which is in `excluded`, and stops once `found` holds `MAX_ENUMERATED_GROUPS`.
 */
const extend = (
  search: {
    readonly adjacency: Adjacency;
    readonly found: Array<ReadonlyArray<string>>;
  },
  members: ReadonlyArray<string>,
  candidates: Set<string>,
  excluded: Set<string>,
): void => {
  const { adjacency, found } = search;
  if (found.length >= MAX_ENUMERATED_GROUPS) {
    return;
  }
  if (candidates.size === 0) {
    if (excluded.size === 0) {
      found.push(members);
    }
    return;
  }
  const pivot = [...candidates, ...excluded].reduce((best, path) =>
    intersection(candidates, adjacency.get(path) ?? new Set()).size >
    intersection(candidates, adjacency.get(best) ?? new Set()).size
      ? path
      : best,
  );
  const skipped = adjacency.get(pivot) ?? new Set<string>();
  for (const path of [...candidates].filter((each) => !skipped.has(each))) {
    const neighbours = adjacency.get(path) ?? new Set<string>();
    extend(
      search,
      [...members, path],
      intersection(candidates, neighbours),
      intersection(excluded, neighbours),
    );
    candidates.delete(path);
    excluded.add(path);
  }
};

/** The fewest changes any two members of the group shared: how well the group's weakest link is evidenced. */
const weakestLink = (
  members: ReadonlyArray<string>,
  coChange: ModuleCoChange,
): number =>
  Math.min(
    ...members.flatMap((low, index) =>
      members.slice(index + 1).map((high) => {
        const [first, second] =
          Order.String(low, high) <= 0 ? [low, high] : [high, low];
        return coChange.shared.get(first)?.get(second) ?? 0;
      }),
    ),
  );

const percentOf = (share: number): number => Math.round(share * 100);

const reasonFor = (
  size: number,
  weakestShare: number,
  sharedCommits: number,
): string =>
  `${size} modules of which every pair shares at least ${percentOf(weakestShare)}% of the smaller one's changes; ${sharedCommits} ${sharedCommits === 1 ? "change touched" : "changes touched"} all of them`;

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

/** The cliques of a window and whether the search for sub-groups hit a bound. */
export type Cliques = {
  readonly cliques: ReadonlyArray<Clique>;
  /** A bound was hit (more than 1000 maximal groups of modules, or a group too varied to search in full, see `supportedSubgroups`): a clique may be missing. */
  readonly partial: boolean;
};

/**
 * The cliques among the ranked modules of `coChange`: maximal groups of at
 * least three of which every pair shares at least `MIN_CLIQUE_SHARE` of the
 * smaller module's counted changes and at least `MIN_SHARED_COMMITS` changes,
 * and of which at least `MIN_SHARED_COMMITS` changes touched every member
 * (pairs that met only in different changes are no unit of change). A group
 * that fails the last rule is searched for its sub-groups that pass it, and
 * only the maximal ones are kept (the 1000 maximal groups with the best evidenced weakest
 * link at most, see `Cliques.partial`). A clique inside another is dropped, and of
 * two variants of one unit (their union pairwise linked, almost all members in
 * common) only the stronger stays (see `distinctGroups`). `touched` lists the
 * modules each counted change touched. The `MAX_CLIQUES` whose members changed
 * together in the most changes come first, then the higher weakest share, more
 * members, and path.
 */
export const findCliques = (
  coChange: ModuleCoChange,
  touched: ReadonlyArray<ReadonlySet<string>>,
): Cliques => {
  const adjacency = linkedModules(coChange);
  const enumerated: Array<ReadonlyArray<string>> = [];
  extend(
    { adjacency, found: enumerated },
    [],
    new Set(adjacency.keys()),
    new Set(),
  );
  const maximal = enumerated
    .filter((members) => members.length >= MIN_CLIQUE_SIZE)
    .map((members) => members.toSorted((a, b) => Order.String(a, b)));
  const searched = maximal
    .map((members) => ({ members, evidence: weakestLink(members, coChange) }))
    .toSorted(
      (a, b) =>
        b.evidence - a.evidence ||
        b.members.length - a.members.length ||
        Order.String(a.members.join("\n"), b.members.join("\n")),
    )
    .slice(0, MAX_SEARCHED_GROUPS)
    .map(({ members }) =>
      supportedSubgroups(members, touched, MIN_CLIQUE_SIZE, MIN_SHARED_COMMITS),
    );
  const groups = searched.flatMap(({ groups: found }) => found);
  const cliques = distinctGroups(
    [
      ...new Map(
        groups.map((members) => [members.join("\n"), members]),
      ).values(),
    ].map((members) => toClique(members, coChange, touched)),
    (a, b) => adjacency.get(a)?.has(b) === true,
  )
    .toSorted(byUnity)
    .slice(0, MAX_CLIQUES);
  return {
    cliques,
    partial:
      enumerated.length >= MAX_ENUMERATED_GROUPS ||
      maximal.length > MAX_SEARCHED_GROUPS ||
      searched.some(({ partial }) => partial),
  };
};
