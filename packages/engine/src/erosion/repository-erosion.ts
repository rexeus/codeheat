// Owns the repository-level verdict: whether the changes of the series stay
// inside one module as often as they used to.
import type { Erosion } from "../model/erosion.js";
import type { SeriesWindow } from "../model/series.js";
import { judgeRobustShift } from "./shift-gate.js";
import type { WindowShare } from "./shift-gate.js";
import { fitLine } from "./trend-line.js";
import type { WindowValue } from "./trend-line.js";

/** The active windows' values of `measure`, with their positions in the series; windows it does not measure are left out. */
const valuesOf = (
  windows: ReadonlyArray<SeriesWindow>,
  measure: (window: SeriesWindow) => number | undefined,
): ReadonlyArray<WindowValue> =>
  windows.flatMap((window, index) => {
    const value = window.active ? measure(window) : undefined;
    return value === undefined ? [] : [{ index, value }];
  });

/** The share of local changes of each active window that has a change radius, with the changes it is the share of. */
const localShares = (
  windows: ReadonlyArray<SeriesWindow>,
): ReadonlyArray<WindowShare> =>
  windows.flatMap(({ active, changeRadius }, index) =>
    active && changeRadius !== null
      ? [{ index, value: changeRadius.local, changes: changeRadius.changes }]
      : [],
  );

/** The start of the run of inactive windows that ends the series, or null when the last window is active. */
const inactiveSince = (windows: ReadonlyArray<SeriesWindow>): string | null => {
  const lastActive = windows.findLastIndex(({ active }) => active);
  return windows[lastActive + 1]?.since ?? null;
};

/**
 * Judges the `windows` of a series, oldest first. Null for no window at all.
 *
 * Only active windows count, wherever they lie: a robust line is fitted
 * through the locality of the active windows (see `fitLine`), and the verdict
 * follows how far it moved (see `judgeRobustShift`): down is `eroding`, up
 * `improving`, anything within what chance and the minimum shift allow, or
 * that one window at either end could have made, `holding`; `unknown`
 * without enough windows. Inactive windows are left out,
 * so they can neither cause nor hide a verdict; a quiet end of the series is
 * reported as `inactiveSince` next to it.
 */
export const judgeErosion = (
  windows: ReadonlyArray<SeriesWindow>,
): Erosion | null => {
  if (windows.length === 0) {
    return null;
  }
  const shares = localShares(windows);
  const line = fitLine(shares);
  const base = {
    windows: shares.length,
    inactiveSince: inactiveSince(windows),
    locality: line,
    propagationCost: fitLine(
      valuesOf(windows, (window) => window.propagationCost?.cost),
    ),
  };
  return {
    ...base,
    verdict: line === null ? "unknown" : judgeRobustShift(shares, line),
  };
};
