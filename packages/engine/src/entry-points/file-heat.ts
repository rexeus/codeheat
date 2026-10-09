// Owns the heat share of a set of files: how much of all the heat they hold.
import { heatOfFile } from "../heat/file-heat.js";
import type { FileStats } from "../model/analysis.js";

/** What the entry points ask of the files' heat. */
export type FileHeat = {
  /**
   * The share of all the heat that the files named by `paths` hold, each
   * counted once; a path that names no file holds none, and no heat at all
   * gives 0.
   */
  readonly share: (paths: Iterable<string>) => number;
  /** The share of all the heat that the files hold, each scaled by its weight. */
  readonly weighted: (
    weights: Iterable<readonly [path: string, weight: number]>,
  ) => number;
  /** The counted changes that touched the file; 0 for a path that names no file. */
  readonly changesOf: (path: string) => number;
};

/**
 * The heat of `files` (no test code: tests are no design), as questions about
 * sets of paths. Every entry point scores in this one unit.
 */
export const fileHeatOf = (
  files: ReadonlyArray<
    Pick<FileStats, "path" | "changes" | "loc" | "complexity">
  >,
): FileHeat => {
  const heat = new Map(files.map((file) => [file.path, heatOfFile(file)]));
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
