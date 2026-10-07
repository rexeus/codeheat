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
 * The pooled stays of `judged` in one window: of the touches of a judged
 * area by a counted change (a change that touched two judged areas touched
 * each), the share by a change that touched no other area. Null when the
 * window has fewer than `minWindowChanges` counted changes or touches.
 */
const pooledStays = (
  touched: ReadonlyArray<ReadonlySet<string>>,
  judged: ReadonlySet<string>,
  { minWindowChanges }: TrendLimits,
): Omit<WindowShare, "index"> | null => {
  let touching = 0;
  let local = 0;
  for (const areas of touched) {
    const hits = [...areas].filter((area) => judged.has(area)).length;
    touching += hits;
    local += areas.size === 1 ? hits : 0;
  }
  return touched.length < minWindowChanges || touching < minWindowChanges
    ? null
    : { value: local / touching, changes: touching };
};

/**
 * Whether the areas `judged` (ids of the areas the verdict judges) keep more
 * or less of their changes inside over the series: per window (`windows`,
 * oldest first, the areas each counted change touched, at the detail the
 * verdict judges), the pooled stays of the judged areas (see `pooledStays`),
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
    const stays = pooledStays(touched, judged, limits);
    return stays === null ? [] : [{ index, ...stays }];
  });
  const line = fitLine(points);
  return line === null || points.length < limits.minVerdictWindows
    ? "unknown"
    : judgeRobustShift(points, line);
};
