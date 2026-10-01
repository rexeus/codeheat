// Owns comparing two adjacent windows: how each file's score and each module's
// cohesion moved. Both windows are measured with the same universe and thresholds.
import type { Module } from "../report/module.js";
import { roundReported } from "../report/precision.js";
import type { FileStats } from "../report/report.js";

/** What one window's measurement says; a `Report`'s files and modules, plus its commit count. */
type WindowMeasure = {
  /** Commits in the window that touched the universe. */
  readonly commits: number;
  readonly files: ReadonlyArray<FileStats>;
  readonly modules: ReadonlyArray<Module>;
};

const withFileTrends = (
  current: WindowMeasure,
  previous: WindowMeasure,
): ReadonlyArray<FileStats> => {
  // Scores are normalized within their window, so an empty window has no scale to compare against.
  if (current.commits === 0 || previous.commits === 0) {
    return current.files;
  }
  const before = new Map(previous.files.map((file) => [file.path, file]));
  return current.files.map((file) => {
    const previousScore = before.get(file.path)?.score ?? 0;
    return {
      ...file,
      trend: {
        previousScore,
        scoreDelta: roundReported(file.score - previousScore),
        newlyActive:
          file.revisions > 0 && (before.get(file.path)?.revisions ?? 0) === 0,
      },
    };
  });
};

const withModuleTrends = (
  current: ReadonlyArray<Module>,
  previous: ReadonlyArray<Module>,
): ReadonlyArray<Module> => {
  const previousCohesion = new Map(
    previous.map((module) => [module.path, module.cohesion]),
  );
  return current.map((module) => {
    const before = previousCohesion.get(module.path) ?? null;
    return module.cohesion === null || before === null
      ? module
      : {
          ...module,
          trend: {
            previousCohesion: before,
            cohesionDelta: roundReported(module.cohesion - before),
          },
        };
  });
};

/**
 * Attaches `trend` to the files and modules of `current`, keeping their order.
 *
 * A file's delta is the difference of its normalized scores, so it shows
 * movement relative to each window's hottest file, not in absolute change.
 * A file with revisions only in `current` is `newlyActive`: its delta is its
 * score, which says it appeared, not that it warmed up.
 * A file has no trend when either window has no commit; a module has none
 * when it has no counted commit in either window.
 */
export const withTrends = (
  current: WindowMeasure,
  previous: WindowMeasure,
): Pick<WindowMeasure, "files" | "modules"> => ({
  files: withFileTrends(current, previous),
  modules: withModuleTrends(current.modules, previous.modules),
});
