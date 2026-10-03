// Owns how each module's cohesion moved over the windows of the series.
import { minModuleCommitsFor } from "../modules/cohesion.js";
import type { ModuleErosion } from "../report/erosion.js";
import type { Module } from "../report/module.js";
import { roundReported } from "../report/precision.js";
import { fitLine } from "./trend-line.js";
import type { WindowValue } from "./trend-line.js";

/** How many of the latest windows count as "still changing". */
const RECENT_WINDOWS = 2;

type Tally = { commits: number; local: number };

/** Per module, how many of a window's counted changes touched it and how many of those touched nothing else. */
const tallyWindow = (
  touched: ReadonlyArray<ReadonlySet<string>>,
): ReadonlyMap<string, Tally> => {
  const tallies = new Map<string, Tally>();
  for (const modules of touched) {
    for (const path of modules) {
      const tally = tallies.get(path) ?? { commits: 0, local: 0 };
      tally.commits += 1;
      tally.local += modules.size === 1 ? 1 : 0;
      tallies.set(path, tally);
    }
  }
  return tallies;
};

/** A module's cohesion in each window, null where it lacks the changes of a ranked module in a window of that size. */
const cohesionOf = (
  path: string,
  windows: ReadonlyArray<{
    readonly size: number;
    readonly tallies: ReadonlyMap<string, Tally>;
  }>,
): ReadonlyArray<number | null> =>
  windows.map(({ size, tallies }) => {
    const tally = tallies.get(path);
    return tally === undefined || tally.commits < minModuleCommitsFor(size)
      ? null
      : tally.local / tally.commits;
  });

const erosionOf = (
  cohesion: ReadonlyArray<number | null>,
): ModuleErosion | null => {
  const points = cohesion.flatMap((value, index): Array<WindowValue> =>
    value === null ? [] : [{ index, value }],
  );
  const line = fitLine(points);
  if (line === null) {
    return null;
  }
  return {
    ...line,
    windows: points.length,
    cohesion: cohesion.map((value) =>
      value === null ? null : roundReported(value),
    ),
    recent: cohesion.slice(-RECENT_WINDOWS).some((value) => value !== null),
  };
};

/**
 * Sets `erosion` on every module that is not test-only: its cohesion in each
 * window, given the distinct modules each counted change of the window touched
 * (see `touchedModules`), oldest window first. A module has no `erosion`
 * without evidence in enough windows (see `fitLine`).
 */
export const withModuleErosion = (
  modules: ReadonlyArray<Module>,
  windows: ReadonlyArray<ReadonlyArray<ReadonlySet<string>>>,
): ReadonlyArray<Module> => {
  const tallied = windows.map((touched) => ({
    size: touched.length,
    tallies: tallyWindow(touched),
  }));
  return modules.map((module) => ({
    ...module,
    erosion: module.testOnly
      ? null
      : erosionOf(cohesionOf(module.path, tallied)),
  }));
};
