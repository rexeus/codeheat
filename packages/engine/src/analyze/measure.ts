// Owns the pure part of an analysis: scoring files, coupling them, and measuring modules,
// in the latest window and, when comparing, against the window before it.
import { measureContracts } from "../contracts/stats.js";
import { findCouplings } from "../coupling/coupling.js";
import type { Couplings } from "../coupling/coupling.js";
import type { History } from "../history/history.js";
import { withoutPaths } from "../history/without-paths.js";
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

/** The universe with its modules and their entry points: what every window is measured over. */
export type Universe = {
  /** The code files; the only ones that are scored and counted in modules. */
  readonly files: ReadonlyArray<InventoryFile>;
  /** The module of every code file. */
  readonly modules: ReadonlyMap<string, ModuleRef>;
  /** The module every contract file lives in. */
  readonly contracts: ReadonlyMap<string, ModuleRef>;
  readonly entryPoints: ReadonlyMap<string, ReadonlyArray<string>>;
};

/** The coupled pairs of a window's history, without import relations. */
export const coupleHistory = (
  history: History,
  { modules, contracts }: Pick<Universe, "modules" | "contracts">,
): Couplings =>
  findCouplings(
    history.commits,
    history.paths,
    new Map(
      [...history.files].map(([file, activity]) => [file, activity.revisions]),
    ),
    {
      modules: new Map([...modules, ...contracts]),
      contracts: new Set(contracts.keys()),
    },
  );

/** Scores the files and measures the modules around the couplings; the pure part of an analysis. */
const measure = (
  { files, modules, contracts, entryPoints }: Universe,
  history: History,
  { couplingCommits, couplings, breadth }: Couplings,
) => {
  const thresholds = thresholdsFor(couplingCommits);
  // A contract is neither interface nor implementation of its module.
  const interfaces = measureInterfaces(
    withoutPaths(history, new Set(contracts.keys())),
    modules,
    entryPoints,
  );
  const measuredModules = measureModules(
    history,
    { modules, contracts },
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
    contracts: measureContracts(contracts, history),
    modules: measuredModules,
  };
};

/**
 * Measures the latest window, whose couplings are `couplings` (see
 * `coupleHistory`); with a previous one, also its files and modules with the
 * trend against it. `commits`, `couplingCommits`, and `thresholds` describe
 * the latest window.
 */
export const measureWindows = (
  universe: Universe,
  histories: WindowHistories,
  couplings: Couplings,
) => {
  const current = measure(universe, histories.current, couplings);
  if (histories.previous === null) {
    return current;
  }
  const previous = measure(
    universe,
    histories.previous,
    coupleHistory(histories.previous, universe),
  );
  return {
    ...current,
    ...withTrends(current, previous, current.thresholds.minModuleCommits),
  };
};
