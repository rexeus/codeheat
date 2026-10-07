// Owns the measure the verdict's trend follows in one window of the series:
// how much of the changes touching the judged areas stayed inside one area.
import type { WindowShare } from "../erosion/shift-gate.js";

/**
 * The stays of `judged` in one window, given the areas each counted change of
 * the window touched: of the changes that touched a judged area, each counted
 * once, the share that touched no other area, with how many changes that is.
 * Changes are the unit, so the share's binomial variance (see
 * `judgeRobustShift`) is over independent draws: a change that touched two
 * judged areas is one change that left both. Null when the window has fewer
 * than `minWindowChanges` counted changes, or fewer changes touching a judged
 * area.
 */
export const windowStays = (
  touched: ReadonlyArray<ReadonlySet<string>>,
  judged: ReadonlySet<string>,
  minWindowChanges: number,
): Omit<WindowShare, "index"> | null => {
  const touching = touched.filter((areas) =>
    [...areas].some((area) => judged.has(area)),
  );
  const local = touching.filter((areas) => areas.size === 1).length;
  return touched.length < minWindowChanges || touching.length < minWindowChanges
    ? null
    : { value: local / touching.length, changes: touching.length };
};
