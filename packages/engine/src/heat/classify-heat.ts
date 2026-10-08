// Owns telling chronic hotspots from acute ones: how many windows of the
// series a file was among the hottest in.
import { MIN_TREND_WINDOWS } from "../erosion/trend-line.js";
import type { Heat } from "../model/heat.js";

/** What one window of the series says about the files. */
export type HeatWindow = {
  /** The window has enough changes to count (see `SeriesWindow.active`). */
  readonly active: boolean;
  /** The files with a revision in the window. */
  readonly touched: ReadonlySet<string>;
  /** The files that are hot in it (see `hotFiles`). */
  readonly hot: ReadonlySet<string>;
};

/** How many of the latest windows are "now": a chronic hotspot is judged on the windows before them, an acute one on them. */
const RECENT_WINDOWS = 2;

/**
 * How long `path` has been hot over `windows`, oldest first; null when it is
 * neither chronic nor acute (see `Heat`).
 *
 * The windows that count for the file are the active ones from its first
 * revision on. It is chronic when at least `MIN_TREND_WINDOWS` of them lie
 * before the last two and it was hot in at least half of those, and in at
 * least half of all that count (the last two included): the first keeps a
 * file that became hot in the last two windows of a short series from being
 * chronic, the second one that was hot early and has long since cooled. Otherwise it is acute when it was
 * hot in both of the last two windows, in fewer than half of the windows
 * before them that count for it (so a file that was hot all along, in a
 * series too short to call it chronic, is neither), and an active window
 * before them exists to compare with. A file that was hot for one window only
 * never is.
 */
export const heatOf = (
  path: string,
  windows: ReadonlyArray<HeatWindow>,
): Heat | null => {
  const first = windows.findIndex(({ touched }) => touched.has(path));
  if (first === -1) {
    return null;
  }
  const recentFrom = windows.length - RECENT_WINDOWS;
  const counting = windows.flatMap((window, index) =>
    window.active && index >= first
      ? [{ index, hot: window.hot.has(path) }]
      : [],
  );
  const earlier = counting.filter(({ index }) => index < recentFrom);
  const hotEarlier = earlier.filter(({ hot }) => hot).length;
  const base = {
    hotWindows: counting.filter(({ hot }) => hot).length,
    windows: counting.length,
  };
  if (
    earlier.length >= MIN_TREND_WINDOWS &&
    hotEarlier * 2 >= earlier.length &&
    base.hotWindows * 2 >= base.windows
  ) {
    return { ...base, kind: "chronic" };
  }
  const hotNow = counting.filter(
    ({ index, hot }) => index >= recentFrom && hot,
  ).length;
  const hasEarlierWindow = windows.some(
    ({ active }, index) => active && index < recentFrom,
  );
  const wasHotBefore = hotEarlier * 2 >= Math.max(earlier.length, 1);
  return hotNow === RECENT_WINDOWS && hasEarlierWindow && !wasHotBefore
    ? { ...base, kind: "acute" }
    : null;
};
