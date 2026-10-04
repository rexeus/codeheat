// Owns the heat share of a set of files: how much of all the production
// code's heat they hold.
import type { FileStats } from "../report/report.js";
import type { Territory } from "../report/territory.js";
import { chainsOf } from "./ancestry.js";

/** The heat of a file: `changes × (loc + complexity.total)`, as `Territory.heatShare` counts it. */
const heatOf = ({
  changes,
  loc,
  complexity,
}: Pick<FileStats, "changes" | "loc" | "complexity">): number =>
  changes * (loc + complexity.total);

/** What the entry points ask of the files' heat. */
export type FileHeat = {
  /**
   * The share of all the production code's heat (the heat of every file that
   * is not test code) that the files named by `paths` hold, each counted once;
   * a path that names no file, or a test file, holds none, and no heat at all
   * gives 0.
   */
  readonly share: (paths: Iterable<string>) => number;
  /** The share of all the production code's heat that the files hold, each scaled by its weight. */
  readonly weighted: (
    weights: Iterable<readonly [path: string, weight: number]>,
  ) => number;
  /** The counted changes that touched the file; 0 for a path that names no file. */
  readonly changesOf: (path: string) => number;
};

/**
 * The heat of the production code of `files` (a test file holds none, in the
 * total too), as questions about sets of paths. Every entry point scores in
 * this one unit; tests are change effort but not design.
 */
export const fileHeatOf = (
  files: ReadonlyArray<
    Pick<FileStats, "path" | "test" | "changes" | "loc" | "complexity">
  >,
): FileHeat => {
  const heat = new Map(
    files.map((file) => [file.path, file.test ? 0 : heatOf(file)]),
  );
  const changes = new Map(files.map(({ path, changes: own }) => [path, own]));
  const total = [...heat.values()].reduce((sum, own) => sum + own, 0);
  const weighted = (
    weights: Iterable<readonly [path: string, weight: number]>,
  ): number =>
    total === 0
      ? 0
      : [...weights].reduce(
          (sum, [path, weight]) => sum + (heat.get(path) ?? 0) * weight,
          0,
        ) / total;
  return {
    share: (paths) => weighted([...new Set(paths)].map((path) => [path, 1])),
    weighted,
    changesOf: (path) => changes.get(path) ?? 0,
  };
};

/**
 * For every territory, the share of all the production code's heat (test code
 * left out of the territory and of the total) that its files hold, below it
 * included; `nodes` is the territory tree and each file names its finest
 * territory. Tests are change effort but not design, so this is the base the
 * entry points that judge a territory rank on.
 */
export const codeHeatShares = (
  files: ReadonlyArray<
    Pick<FileStats, "territory" | "test" | "changes" | "loc" | "complexity">
  >,
  nodes: ReadonlyArray<Pick<Territory, "id" | "parent">>,
): ReadonlyMap<string, number> => {
  const chainOf = chainsOf(nodes);
  const heat = new Map<string, number>();
  let total = 0;
  for (const file of files) {
    if (file.test) {
      continue;
    }
    const own = heatOf(file);
    total += own;
    for (const id of chainOf(file.territory)) {
      heat.set(id, (heat.get(id) ?? 0) + own);
    }
  }
  return new Map(
    [...heat].map(([id, own]) => [id, total === 0 ? 0 : own / total]),
  );
};
