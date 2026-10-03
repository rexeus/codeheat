// Owns deciding whether a share moved over the series by more than chance
// explains, so that a flat design is not reported as eroding or improving.
import type { TrendLine } from "../report/erosion.js";
import type { WindowValue } from "./trend-line.js";

/** How far (as a share of the changes) a line must move to be called eroding or improving, however sure we are. */
export const MIN_EROSION_SHIFT = 0.1;

/** How many standard errors of the shift the line must move to be called eroding or improving. */
export const MIN_EROSION_SIGMAS = 2;

/**
 * Allowance on the standard error for what the binomial model leaves out: the
 * Theil–Sen line is about 5 % less efficient than a weighted least-squares
 * line under such noise, and the changes of one feature burst correlate, so a
 * window's share varies more than a coin would. With it, flat series read
 * holding in more than 95 % of simulated cases.
 */
const SE_ALLOWANCE = 1.15;

/** A share never has less sampling variance than at 5 %: a window of only local changes does not make the line exact. */
const SHARE_FLOOR = 0.05;

/** A share of the changes in a window, with how many changes it is the share of. */
export type WindowShare = WindowValue & { readonly changes: number };

/**
 * The standard error of the line's shift from the first to the last of
 * `points`, which must have at least two distinct positions. Each window's
 * share is the share of its `changes`, so it has a binomial variance
 * `p(1-p)/changes`, with `p` the share of all the changes pooled (the
 * variance under a flat share). A weighted least-squares line through such
 * points has a slope variance of `1 / sum(w * (index - mean)^2)` with
 * weights `changes / (p(1-p))`, and the shift is the slope times the span.
 * The result is scaled by `SE_ALLOWANCE`.
 */
const standardErrorOfShift = (points: ReadonlyArray<WindowShare>): number => {
  const changes = points.reduce((sum, point) => sum + point.changes, 0);
  const pooled =
    points.reduce((sum, point) => sum + point.value * point.changes, 0) /
    changes;
  const share = Math.min(1 - SHARE_FLOOR, Math.max(SHARE_FLOOR, pooled));
  const variance = share * (1 - share);
  const meanIndex =
    points.reduce((sum, point) => sum + point.index * point.changes, 0) /
    changes;
  const spread = points.reduce(
    (sum, point) =>
      sum + (point.changes / variance) * (point.index - meanIndex) ** 2,
    0,
  );
  const first = points[0]?.index ?? 0;
  const last = points.at(-1)?.index ?? 0;
  return (SE_ALLOWANCE * (last - first)) / Math.sqrt(spread);
};

/**
 * Whether `line`, fitted through `points` (the windows with evidence, in
 * order), fell, rose, or held: it moved only when the shift from its first to
 * its last value is at least `MIN_EROSION_SHIFT` and at least
 * `MIN_EROSION_SIGMAS` standard errors of that shift (see
 * `standardErrorOfShift`), so a series that only wobbles around one level
 * holds.
 */
export const judgeShift = (
  points: ReadonlyArray<WindowShare>,
  line: TrendLine,
): "eroding" | "improving" | "holding" => {
  const needed = Math.max(
    MIN_EROSION_SHIFT,
    MIN_EROSION_SIGMAS * standardErrorOfShift(points),
  );
  const shift = line.to - line.from;
  if (shift <= -needed) {
    return "eroding";
  }
  return shift >= needed ? "improving" : "holding";
};
