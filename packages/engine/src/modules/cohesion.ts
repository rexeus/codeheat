// Owns how self-contained each module's changes are: counted commits that
// stay inside it, and which other modules the rest pull in.
import { Order } from "effect";

import { MAX_COMMIT_FILES } from "../coupling/coupling.js";
import type { Module } from "../report/module.js";
import { roundReported } from "../report/precision.js";
import type { ModuleRef } from "./detect.js";

/** Fewest counted commits a module needs to be ranked by its cohesion. */
export const MIN_MODULE_COMMITS = 5;
const MAX_PARTNERS = 5;

type Tally = {
  readonly kind: ModuleRef["kind"];
  files: number;
  commits: number;
  localCommits: number;
  /** Shared commits per other module path. */
  readonly shared: Map<string, number>;
};

const byCohesion = (a: Module, b: Module): number => {
  if (a.cohesion === null || b.cohesion === null) {
    return Number(a.cohesion === null) - Number(b.cohesion === null);
  }
  return (
    a.cohesion - b.cohesion ||
    b.commits - a.commits ||
    Order.String(a.path, b.path)
  );
};

const byPartnerStrength = (
  a: Module["partners"][number],
  b: Module["partners"][number],
): number => b.sharedCommits - a.sharedCommits || Order.String(a.path, b.path);

const tallyFiles = (
  refs: ReadonlyMap<string, ModuleRef>,
): ReadonlyMap<string, Tally> => {
  const tallies = new Map<string, Tally>();
  for (const { path, kind } of refs.values()) {
    const tally = tallies.get(path) ?? {
      kind,
      files: 0,
      commits: 0,
      localCommits: 0,
      shared: new Map(),
    };
    tally.files += 1;
    tallies.set(path, tally);
  }
  return tallies;
};

/** Credits one commit, given the distinct modules it touched, to each of them. */
const countCommit = (
  touched: ReadonlySet<string>,
  tallies: ReadonlyMap<string, Tally>,
): void => {
  for (const path of touched) {
    const tally = tallies.get(path);
    if (tally === undefined) {
      continue;
    }
    tally.commits += 1;
    if (touched.size === 1) {
      tally.localCommits += 1;
    }
    for (const other of touched) {
      if (other !== path) {
        tally.shared.set(other, (tally.shared.get(other) ?? 0) + 1);
      }
    }
  }
};

const toModule = (path: string, tally: Tally): Module => ({
  path,
  kind: tally.kind,
  files: tally.files,
  commits: tally.commits,
  localCommits: tally.localCommits,
  cohesion:
    tally.commits === 0
      ? null
      : roundReported(tally.localCommits / tally.commits),
  partners: [...tally.shared]
    .map(([partner, sharedCommits]) => ({ path: partner, sharedCommits }))
    .toSorted(byPartnerStrength)
    .slice(0, MAX_PARTNERS),
});

/**
 * Measures every module over the counted commits (at most `MAX_COMMIT_FILES`
 * files). Each commit is the distinct ids of the files it touched, ids being
 * indexes into `paths`; `refs` maps every one of those paths to its module.
 *
 * A module's cohesion is the share of its commits that touched no other
 * module. Modules come back least cohesive first, those without commits last.
 */
export const measureModules = (
  commits: ReadonlyArray<Uint32Array>,
  paths: ReadonlyArray<string>,
  refs: ReadonlyMap<string, ModuleRef>,
): ReadonlyArray<Module> => {
  const tallies = tallyFiles(refs);
  const moduleOfId = paths.map((path) => refs.get(path)?.path ?? ".");
  for (const commit of commits) {
    if (commit.length <= MAX_COMMIT_FILES) {
      countCommit(
        new Set(Array.from(commit, (id) => moduleOfId[id] ?? ".")),
        tallies,
      );
    }
  }
  return [...tallies]
    .map(([path, tally]) => toModule(path, tally))
    .toSorted(byCohesion);
};
