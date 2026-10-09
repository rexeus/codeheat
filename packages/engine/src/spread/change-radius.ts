// Owns the change radius: how many modules the counted changes touched, for
// the repository and for each module.
import type { ChangeRadius } from "../model/change-radius.js";
import type { Module } from "../model/module.js";
import { roundReported } from "../model/precision.js";

const MEDIAN = 0.5;
const P90 = 0.9;

/** The value at nearest rank `ceil(share × n)` of `sorted`, which must not be empty. */
const nearestRank = (sorted: ReadonlyArray<number>, share: number): number =>
  sorted[Math.max(0, Math.ceil(share * sorted.length) - 1)] ?? 1;

const ascending = (a: number, b: number): number => a - b;

/** The radius of changes that touched `counts` modules each; null without any. */
const radiusOf = (counts: ReadonlyArray<number>): ChangeRadius | null => {
  if (counts.length === 0) {
    return null;
  }
  const sorted = counts.toSorted(ascending);
  return {
    changes: sorted.length,
    median: nearestRank(sorted, MEDIAN),
    p90: nearestRank(sorted, P90),
    local: roundReported(
      sorted.filter((count) => count === 1).length / sorted.length,
    ),
  };
};

/**
 * Measures how far the counted changes spread, over `touched` (the modules
 * each counted change touched, see `touchedModules`) and the partition of
 * `modules`. Test-only modules are left out of every change: the test of a
 * change is no spread, and a change that touched nothing else is not
 * measured. The repository's `changeRadius` is null when no change is
 * measured; a module's `radius` is the median number of modules, itself
 * included, touched by the measured changes that touched it, null without
 * any. Medians are lower medians (see `ChangeRadius.median`).
 *
 * Every module comes back with its `radius` set. Any area with a `path` can
 * stand in for a module (territories do), as long as `touched` names the same
 * paths.
 */
export const measureRadius = <Area extends Pick<Module, "path">>(
  touched: ReadonlyArray<ReadonlySet<string>>,
  modules: ReadonlyArray<Area>,
): {
  readonly changeRadius: ChangeRadius | null;
  readonly modules: ReadonlyArray<Area & Pick<Module, "radius">>;
} => {
  const counts: Array<number> = [];
  const countsByModule = new Map<string, Array<number>>();
  for (const change of touched) {
    if (change.size === 0) {
      continue;
    }
    counts.push(change.size);
    for (const path of change) {
      const known = countsByModule.get(path) ?? [];
      known.push(change.size);
      countsByModule.set(path, known);
    }
  }
  return {
    changeRadius: radiusOf(counts),
    modules: modules.map((module) => {
      const own = countsByModule.get(module.path);
      return {
        ...module,
        radius:
          own === undefined
            ? null
            : nearestRank(own.toSorted(ascending), MEDIAN),
      };
    }),
  };
};
