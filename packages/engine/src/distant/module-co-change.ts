// Owns how often ranked modules change in the same commits: the shared
// commits of every pair, and the coupling matrix data derived from them.
import { Order } from "effect";

import { MIN_SHARED_COMMITS } from "../coupling/coupling.js";
import type { ModuleCoupling } from "../report/module-coupling.js";
import type { Module } from "../report/module.js";
import { roundReported } from "../report/precision.js";

/** The report keeps this many module couplings, those with the largest share first. */
const MAX_MODULE_COUPLINGS = 200;

/** The counted commits of the ranked modules and those they share. */
export type ModuleCoChange = {
  /** Counted commits per ranked module path. */
  readonly commits: ReadonlyMap<string, number>;
  /** Commits that touched both modules, nested as `lower path -> higher path -> count`; pairs that never met are absent. */
  readonly shared: ReadonlyMap<string, ReadonlyMap<string, number>>;
};

/**
 * Counts, over `touched` (the modules each counted commit touched, see
 * `touchedModules`), the commits every pair of ranked modules shares. A module
 * is ranked when it has at least `minModuleCommits` counted commits and is not
 * test-only; the others stay out, since a handful of commits makes any share
 * meaningless and tests would couple to everything.
 */
export const moduleCoChange = (
  touched: ReadonlyArray<ReadonlySet<string>>,
  modules: ReadonlyArray<Module>,
  minModuleCommits: number,
): ModuleCoChange => {
  const commits = new Map(
    modules
      .filter(
        (module) => module.commits >= minModuleCommits && !module.testOnly,
      )
      .map((module) => [module.path, module.commits]),
  );
  const shared = new Map<string, Map<string, number>>();
  for (const commit of touched) {
    const ranked = [...commit]
      .filter((path) => commits.has(path))
      .toSorted((a, b) => Order.String(a, b));
    for (const [index, low] of ranked.entries()) {
      const partners = shared.get(low) ?? new Map<string, number>();
      for (const high of ranked.slice(index + 1)) {
        partners.set(high, (partners.get(high) ?? 0) + 1);
      }
      shared.set(low, partners);
    }
  }
  return { commits, shared };
};

/** The share of the smaller module's commits that touched both; 0 for a module that is not ranked. */
export const sharedShare = (
  { commits, shared }: ModuleCoChange,
  a: string,
  b: string,
): number => {
  const [low, high] = Order.String(a, b) <= 0 ? [a, b] : [b, a];
  const both = shared.get(low)?.get(high) ?? 0;
  const smaller = Math.min(commits.get(a) ?? 0, commits.get(b) ?? 0);
  return smaller === 0 ? 0 : both / smaller;
};

const byShare = (a: ModuleCoupling, b: ModuleCoupling): number =>
  b.share - a.share ||
  b.sharedCommits - a.sharedCommits ||
  Order.String(a.a, b.a) ||
  Order.String(a.b, b.b);

/**
 * The module pairs that share at least `MIN_SHARED_COMMITS` commits, the
 * `MAX_MODULE_COUPLINGS` with the largest share first (then shared commits,
 * then path). Every entry has its paths in sorted order.
 */
export const moduleCouplings = (
  coChange: ModuleCoChange,
): ReadonlyArray<ModuleCoupling> =>
  [...coChange.shared]
    .flatMap(([a, partners]) =>
      [...partners]
        .filter(([, sharedCommits]) => sharedCommits >= MIN_SHARED_COMMITS)
        .map(([b, sharedCommits]) => ({
          a,
          b,
          sharedCommits,
          share: roundReported(sharedShare(coChange, a, b)),
        })),
    )
    .toSorted(byShare)
    .slice(0, MAX_MODULE_COUPLINGS);
