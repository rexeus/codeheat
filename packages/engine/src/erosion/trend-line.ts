// Owns fitting a robust straight line through a measure over the windows of a series.
import type { TrendLine } from "../report/erosion.js";
import { roundReported } from "../report/precision.js";

/** Fewest windows with evidence a trend needs: two always form a line. */
export const MIN_TREND_WINDOWS = 3;

/** A measure of the window at `index` in the series. */
export type WindowValue = {
  readonly index: number;
  readonly value: number;
};

const median = (values: ReadonlyArray<number>): number => {
  const sorted = values.toSorted((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? (sorted[middle] ?? 0)
    : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
};

/** The slope between every two of `points`, which lie at distinct positions. */
const pairwiseSlopes = (
  points: ReadonlyArray<WindowValue>,
): ReadonlyArray<number> =>
  points.flatMap((from, position) =>
    points
      .slice(position + 1)
      .map((to) => (to.value - from.value) / (to.index - from.index)),
  );

/**
 * Fits a robust line through `points` (Theil–Sen) and reads it at the first
 * and the last of them. `points` are in the order of the series. The slope is
 * the median of the slopes between every two points and the intercept the
 * median of what is left of each point, so one odd window cannot turn the
 * line. Null with fewer than `MIN_TREND_WINDOWS` points: too few windows to
 * tell a trend from noise.
 *
 * The line is not held to the range of the measure: it is the line's value at
 * those windows, which a share near 0 or 1 can leave slightly.
 */
export const fitLine = (
  points: ReadonlyArray<WindowValue>,
): TrendLine | null => {
  const first = points[0];
  const last = points.at(-1);
  if (first === undefined || last === undefined) {
    return null;
  }
  if (points.length < MIN_TREND_WINDOWS) {
    return null;
  }
  const slope = median(pairwiseSlopes(points));
  const intercept = median(
    points.map(({ index, value }) => value - slope * index),
  );
  return {
    from: roundReported(intercept + slope * first.index),
    to: roundReported(intercept + slope * last.index),
    // `+ 0` turns a rounded -0 into 0
    slope: roundReported(slope) + 0,
  };
};
