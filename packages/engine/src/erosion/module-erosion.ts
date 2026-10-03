// Owns how each module's cohesion moved over the windows of the series.
import { minModuleCommitsFor } from "../modules/cohesion.js";
import type { ModuleErosion } from "../report/erosion.js";
import type { Module } from "../report/module.js";
import { roundReported } from "../report/precision.js";
import { MIN_WINDOW_CHANGES } from "../series/active-window.js";
import { judgeRobustShift } from "./shift-gate.js";
import type { WindowShare } from "./shift-gate.js";
import { fitLine } from "./trend-line.js";

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

/**
 * A module's cohesion in each window with the changes it is the share of;
 * null where the module had fewer changes than a ranked module needs in a
 * window of that size, and at least `MIN_WINDOW_CHANGES`: with fewer, one
 * change moves the share by ten points or more.
 */
const cohesionOf = (
  path: string,
  windows: ReadonlyArray<{
    readonly size: number;
    readonly tallies: ReadonlyMap<string, Tally>;
  }>,
): ReadonlyArray<{ readonly value: number; readonly changes: number } | null> =>
  windows.map(({ size, tallies }) => {
    const tally = tallies.get(path);
    return tally === undefined ||
      tally.commits < Math.max(MIN_WINDOW_CHANGES, minModuleCommitsFor(size))
      ? null
      : { value: tally.local / tally.commits, changes: tally.commits };
  });

const erosionOf = (
  cohesion: ReturnType<typeof cohesionOf>,
): ModuleErosion | null => {
  const points = cohesion.flatMap((window, index): Array<WindowShare> =>
    window === null ? [] : [{ index, ...window }],
  );
  const line = fitLine(points);
  if (line === null) {
    return null;
  }
  return {
    ...line,
    verdict: judgeRobustShift(points, line),
    windows: points.length,
    cohesion: cohesion.map((window) =>
      window === null ? null : roundReported(window.value),
    ),
    recent: cohesion.slice(-RECENT_WINDOWS).some((window) => window !== null),
  };
};

/**
 * Sets `erosion` on every module that is not test-only: its cohesion in each
 * window, given the distinct modules each counted change of the window touched
 * (see `touchedModules`), oldest window first, and whether it fell, rose, or
 * held (see `judgeRobustShift`). A module has no `erosion` without evidence in
 * enough windows (see `fitLine`).
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
