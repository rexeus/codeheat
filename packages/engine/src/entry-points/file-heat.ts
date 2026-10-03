// Owns the heat share of a set of files: how much of all the heat they hold.
import type { FileStats } from "../report/report.js";

/** The heat of a file: `changes × (loc + complexity.total)`, as `Territory.heatShare` counts it. */
const heatOf = ({
  changes,
  loc,
  complexity,
}: Pick<FileStats, "changes" | "loc" | "complexity">): number =>
  changes * (loc + complexity.total);

/**
 * A function that gives the share of all the heat (the heat of every code
 * file of `files`) that the files named by `paths` hold; a path that names no
 * file holds none, and no heat at all gives 0.
 */
export const heatShareOf = (
  files: ReadonlyArray<
    Pick<FileStats, "path" | "changes" | "loc" | "complexity">
  >,
): ((paths: Iterable<string>) => number) => {
  const heat = new Map(files.map((file) => [file.path, heatOf(file)]));
  const total = [...heat.values()].reduce((sum, own) => sum + own, 0);
  return (paths) =>
    total === 0
      ? 0
      : [...new Set(paths)].reduce(
          (sum, path) => sum + (heat.get(path) ?? 0),
          0,
        ) / total;
};
