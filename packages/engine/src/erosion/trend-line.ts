// Owns fitting a straight line through a measure over the windows of a series.
import type { TrendLine } from "../report/erosion.js";
import { roundReported } from "../report/precision.js";

/** Fewest windows with evidence a trend needs: two always form a line. */
export const MIN_TREND_WINDOWS = 3;

/** A measure of the window at `index` in the series. */
export type WindowValue = {
  readonly index: number;
  readonly value: number;
};

const mean = (values: ReadonlyArray<number>): number =>
  values.reduce((sum, value) => sum + value, 0) / values.length;

const clamped = (value: number): number => Math.min(1, Math.max(0, value));

/**
 * Fits a line through `points` by least squares and reads it at the first and
 * the last of them. `points` are in the order of the series. Null with fewer
 * than `MIN_TREND_WINDOWS` points: too few windows to tell a trend from noise.
 * The measure is a share, so `from` and `to` stay within 0 and 1; the slope is
 * the fitted line's.
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
  const meanIndex = mean(points.map(({ index }) => index));
  const meanValue = mean(points.map(({ value }) => value));
  const spread = points.reduce(
    (sum, { index }) => sum + (index - meanIndex) ** 2,
    0,
  );
  const slope =
    points.reduce(
      (sum, { index, value }) =>
        sum + (index - meanIndex) * (value - meanValue),
      0,
    ) / spread;
  const at = (index: number): number =>
    roundReported(clamped(meanValue + slope * (index - meanIndex)));
  return {
    from: at(first.index),
    to: at(last.index),
    // `+ 0` turns a rounded -0 into 0
    slope: roundReported(slope) + 0,
  };
};
