// Owns the repository-level verdict: whether the changes of the series stay
// inside one module as often as they used to.
import type { Erosion } from "../report/erosion.js";
import type { SeriesWindow } from "../report/series.js";
import { fitLine } from "./trend-line.js";
import type { WindowValue } from "./trend-line.js";

/** How far (as a share of the changes) the fitted locality must move to be called eroding or improving. */
export const MIN_EROSION_SHIFT = 0.1;

/** The active windows' values of `measure`, with their positions in the series; windows it does not measure are left out. */
const valuesOf = (
  windows: ReadonlyArray<SeriesWindow>,
  measure: (window: SeriesWindow) => number | undefined,
): ReadonlyArray<WindowValue> =>
  windows.flatMap((window, index) => {
    const value = window.active ? measure(window) : undefined;
    return value === undefined ? [] : [{ index, value }];
  });

/** The start of the run of inactive windows that ends the series, or null when the last window is active. */
const inactiveSince = (windows: ReadonlyArray<SeriesWindow>): string | null => {
  const lastActive = windows.findLastIndex(({ active }) => active);
  return windows[lastActive + 1]?.since ?? null;
};

/**
 * Judges the `windows` of a series, oldest first. Null for no window at all.
 *
 * Only active windows count, wherever they lie: a line is fitted through the
 * locality of the active windows (see `fitLine`), and the verdict follows how
 * far it moved: by at least `MIN_EROSION_SHIFT` down is `eroding`, up is
 * `improving`, anything else `holding`; `unknown` without enough windows.
 * Inactive windows are left out, so they can neither cause nor hide a verdict;
 * a quiet end of the series is reported as `inactiveSince` next to it.
 */
export const judgeErosion = (
  windows: ReadonlyArray<SeriesWindow>,
): Erosion | null => {
  if (windows.length === 0) {
    return null;
  }
  const locality = valuesOf(windows, (window) => window.changeRadius?.local);
  const line = fitLine(locality);
  const propagationCost = fitLine(
    valuesOf(windows, (window) => window.propagationCost?.cost),
  );
  const base = {
    windows: locality.length,
    locality: line,
    propagationCost,
    inactiveSince: inactiveSince(windows),
  };
  if (line === null) {
    return { ...base, verdict: "unknown" };
  }
  const shift = line.to - line.from;
  if (shift <= -MIN_EROSION_SHIFT) {
    return { ...base, verdict: "eroding" };
  }
  return {
    ...base,
    verdict: shift >= MIN_EROSION_SHIFT ? "improving" : "holding",
  };
};
