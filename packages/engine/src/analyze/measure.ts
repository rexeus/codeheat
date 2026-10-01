// Owns the pure part of an analysis: scoring files, coupling them, and measuring modules,
// in the latest window and, when comparing, against the window before it.
import { findCouplings } from "../coupling/coupling.js";
import type { History } from "../history/history.js";
import { rankFiles } from "../hotspots/hotspots.js";
import type { FileMeasure } from "../hotspots/hotspots.js";
import { measureModules } from "../modules/cohesion.js";
import type { ModuleRef } from "../modules/detect.js";
import {
  leakingEntryPoints,
  measureInterfaces,
} from "../modules/interface-churn.js";
import { withTrends } from "../trends/trends.js";
import type { InventoryFile } from "../universe/inventory.js";
import { thresholdsFor } from "./thresholds.js";
import type { WindowHistories } from "./windows.js";

/** What `measureFiles` looks up per file: co-change breadth, module, and the leakage of the interface it belongs to. */
type FileLookups = {
  readonly breadth: ReadonlyMap<string, number>;
  readonly modules: ReadonlyMap<string, ModuleRef>;
  readonly leakyInterfaces: ReadonlyMap<string, number>;
};

/** Every universe file with the window's activity on it, none for untouched files. */
const measureFiles = (
  files: ReadonlyArray<InventoryFile>,
  history: History,
  { breadth, modules, leakyInterfaces }: FileLookups,
): ReadonlyArray<FileMeasure> =>
  files.map(({ path, complexity }) => {
    const activity = history.files.get(path);
    return {
      path,
      module: modules.get(path)?.path ?? ".",
      revisions: activity?.revisions ?? 0,
      linesAdded: activity?.linesAdded ?? 0,
      linesDeleted: activity?.linesDeleted ?? 0,
      breadth: breadth.get(path) ?? 0,
      interfaceLeakage: leakyInterfaces.get(path),
      complexity,
    };
  });

/** Scores the files, couples them, and measures the modules; the pure part of an analysis. */
const measure = (
  files: ReadonlyArray<InventoryFile>,
  history: History,
  modules: ReadonlyMap<string, ModuleRef>,
  entryPoints: ReadonlyMap<string, ReadonlyArray<string>>,
) => {
  const { couplingCommits, couplings, breadth } = findCouplings(
    history.commits,
    history.paths,
    new Map(
      [...history.files].map(([file, activity]) => [file, activity.revisions]),
    ),
    modules,
  );
  const thresholds = thresholdsFor(couplingCommits);
  const interfaces = measureInterfaces(history, modules, entryPoints);
  const measuredModules = measureModules(
    history,
    modules,
    thresholds.minModuleCommits,
    interfaces.byModule,
  );
  return {
    commits: history.commits.length,
    couplingCommits,
    thresholds,
    files: rankFiles(
      measureFiles(files, history, {
        breadth,
        modules,
        leakyInterfaces: leakingEntryPoints(
          measuredModules,
          interfaces.leakedEntryPoints,
        ),
      }),
      couplings,
    ),
    couplings,
    modules: measuredModules,
  };
};

/**
 * Measures the latest window; with a previous one, also its files and modules
 * with the trend against it. `commits`, `couplingCommits`, and `thresholds`
 * describe the latest window.
 */
export const measureWindows = (
  files: ReadonlyArray<InventoryFile>,
  histories: WindowHistories,
  modules: ReadonlyMap<string, ModuleRef>,
  entryPoints: ReadonlyMap<string, ReadonlyArray<string>>,
) => {
  const current = measure(files, histories.current, modules, entryPoints);
  if (histories.previous === null) {
    return current;
  }
  const previous = measure(files, histories.previous, modules, entryPoints);
  return { ...current, ...withTrends(current, previous) };
};
