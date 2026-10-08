// Owns the trend of the verdict: whether the areas the verdict judges keep
// more or less of their changes inside over the windows of the series.
import { judgeRobustShift } from "../erosion/shift-gate.js";
import type { WindowShare } from "../erosion/shift-gate.js";
import { fitLine } from "../erosion/trend-line.js";
import type { Analysis } from "../model/analysis.js";
import type { Verdict } from "../model/verdict.js";
import { windowStays } from "./window-stays.js";

/** The limits the trend reads, as the report states them. */
type TrendLimits = Pick<
  Analysis["thresholds"],
  "minWindowChanges" | "minVerdictWindows"
>;

/**
 * Whether the areas `judged` (ids of the areas the verdict judges) keep more
 * or less of their changes inside over the series: per window (`windows`,
 * oldest first, the areas each counted change touched, at the detail the
 * verdict judges), the stays of the judged areas (see `windowStays`),
 * a robust line through the windows with evidence (see `fitLine`), and the
 * gate of the erosion verdicts (see `judgeRobustShift`). `unknown` with fewer
 * than `minVerdictWindows` windows with evidence: a fall or a rise needs that
 * many to survive leaving out the first and the last window.
 */
export const judgeAreaTrend = (
  judged: ReadonlySet<string>,
  windows: ReadonlyArray<ReadonlyArray<ReadonlySet<string>>>,
  limits: TrendLimits,
): Verdict["trend"] => {
  const points = windows.flatMap((touched, index): Array<WindowShare> => {
    const stays = windowStays(touched, judged, limits.minWindowChanges);
    return stays === null ? [] : [{ index, ...stays }];
  });
  const line = fitLine(points);
  return line === null || points.length < limits.minVerdictWindows
    ? "unknown"
    : judgeRobustShift(points, line);
};
