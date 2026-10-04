// Owns the heat share of a set of files: how much of all the heat they hold.
import type { FileStats } from "../report/report.js";

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
   * The share of all the heat (the heat of every code file) that the files
   * named by `paths` hold, each counted once; a path that names no file holds
   * none, and no heat at all gives 0.
   */
  readonly share: (paths: Iterable<string>) => number;
  /** The share of all the heat that the files hold, each scaled by its weight. */
  readonly weighted: (
    weights: Iterable<readonly [path: string, weight: number]>,
  ) => number;
  /** The counted changes that touched the file; 0 for a path that names no file. */
  readonly changesOf: (path: string) => number;
};

/** The heat of the code files of `files`, as questions about sets of paths. */
export const fileHeatOf = (
  files: ReadonlyArray<
    Pick<FileStats, "path" | "changes" | "loc" | "complexity">
  >,
): FileHeat => {
  const heat = new Map(files.map((file) => [file.path, heatOf(file)]));
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
