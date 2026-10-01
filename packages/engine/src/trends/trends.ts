// Owns comparing two adjacent windows: how each file's score and each module's
// cohesion moved. Both windows are measured over the same universe (the files
// that exist now) and with the same fixed limits, such as `maxCommitFiles`;
// the module floor `minModuleCommits` is the latest window's.
import type { Module } from "../report/module.js";
import { roundReported } from "../report/precision.js";
import type { FileStats } from "../report/report.js";

/** What one window's measurement says; a `Report`'s files and modules, plus its commit count. */
type WindowMeasure = {
  /** Commits in the window that touched the universe (`window.commits`). */
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
    const previousRevisions = before.get(file.path)?.revisions ?? 0;
    return {
      ...file,
      trend: {
        previousScore,
        previousRevisions,
        scoreDelta: roundReported(file.score - previousScore),
        newlyActive: file.revisions > 0 && previousRevisions === 0,
      },
    };
  });
};

const withModuleTrends = (
  current: ReadonlyArray<Module>,
  previous: ReadonlyArray<Module>,
  minModuleCommits: number,
): ReadonlyArray<Module> => {
  const before = new Map(previous.map((module) => [module.path, module]));
  return current.map((module) => {
    const earlier = before.get(module.path);
    if (
      earlier === undefined ||
      module.cohesion === null ||
      earlier.cohesion === null ||
      module.commits < minModuleCommits ||
      earlier.commits < minModuleCommits
    ) {
      return module;
    }
    return {
      ...module,
      trend: {
        previousCohesion: earlier.cohesion,
        cohesionDelta: roundReported(module.cohesion - earlier.cohesion),
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
 * A file has no trend when either window has no commit. A module has none
 * unless it has at least `minModuleCommits` counted commits in both windows:
 * the cohesion of a handful of commits swings too much to call a change.
 */
export const withTrends = (
  current: WindowMeasure,
  previous: WindowMeasure,
  minModuleCommits: number,
): Pick<WindowMeasure, "files" | "modules"> => ({
  files: withFileTrends(current, previous),
  modules: withModuleTrends(
    current.modules,
    previous.modules,
    minModuleCommits,
  ),
});
