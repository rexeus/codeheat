// Owns the trend of the verdict: whether the areas the verdict judges keep
// more or less of their changes inside over the windows of the series.
import { judgeRobustShift } from "../erosion/shift-gate.js";
import type { WindowShare } from "../erosion/shift-gate.js";
import { fitLine } from "../erosion/trend-line.js";
import type { Report } from "../report/report.js";
import type { Verdict } from "../report/verdict.js";

/** The limits the trend reads, as the report states them. */
type TrendLimits = Pick<
  Report["thresholds"],
  "minWindowChanges" | "minVerdictWindows"
>;

/**
 * The stays of `judged` in one window: of the counted changes that touched a
 * judged area, each counted once, the share that touched no other area.
 * Changes are the unit, so the share's binomial variance (see
 * `judgeRobustShift`) is over independent draws: a change that touched two
 * judged areas is one change that left both. Null when the window has fewer
 * than `minWindowChanges` counted changes or changes touching a judged area.
 */
const windowStays = (
  touched: ReadonlyArray<ReadonlySet<string>>,
  judged: ReadonlySet<string>,
  { minWindowChanges }: TrendLimits,
): Omit<WindowShare, "index"> | null => {
  const touching = touched.filter((areas) =>
    [...areas].some((area) => judged.has(area)),
  );
  const local = touching.filter((areas) => areas.size === 1).length;
  return touched.length < minWindowChanges || touching.length < minWindowChanges
    ? null
    : { value: local / touching.length, changes: touching.length };
};

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
    const stays = windowStays(touched, judged, limits);
    return stays === null ? [] : [{ index, ...stays }];
  });
  const line = fitLine(points);
  return line === null || points.length < limits.minVerdictWindows
    ? "unknown"
    : judgeRobustShift(points, line);
};
