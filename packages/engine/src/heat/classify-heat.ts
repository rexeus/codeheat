// Owns telling chronic hotspots from acute ones: how many windows of the
// series a file was among the hottest in.
import { MIN_TREND_WINDOWS } from "../erosion/trend-line.js";
import type { Heat } from "../report/heat.js";

/** What one window of the series says about the files. */
export type HeatWindow = {
  /** The window has enough changes to count (see `SeriesWindow.active`). */
  readonly active: boolean;
  /** The files with a revision in the window. */
  readonly touched: ReadonlySet<string>;
  /** The files that are hot in it (see `hotFiles`). */
  readonly hot: ReadonlySet<string>;
};

/** How many of the latest windows an acute hotspot may have been hot in. */
const RECENT_WINDOWS = 2;

/**
 * How long `path` has been hot over `windows`, oldest first; null when it is
 * neither chronic nor acute (see `Heat`).
 */
export const heatOf = (
  path: string,
  windows: ReadonlyArray<HeatWindow>,
): Heat | null => {
  const first = windows.findIndex(({ touched }) => touched.has(path));
  if (first === -1) {
    return null;
  }
  const counting = windows.flatMap((window, index) =>
    window.active && index >= first
      ? [{ index, hot: window.hot.has(path) }]
      : [],
  );
  const hotIndexes = counting
    .filter(({ hot }) => hot)
    .map(({ index }) => index);
  const base = { hotWindows: hotIndexes.length, windows: counting.length };
  if (
    counting.length >= MIN_TREND_WINDOWS &&
    hotIndexes.length * 2 >= counting.length
  ) {
    return { ...base, kind: "chronic" };
  }
  const recentFrom = windows.length - RECENT_WINDOWS;
  const hasEarlierWindow = windows.some(
    ({ active }, index) => active && index < recentFrom,
  );
  const hotOnlyRecently =
    hotIndexes.length > 0 && hotIndexes.every((index) => index >= recentFrom);
  return hasEarlierWindow && hotOnlyRecently
    ? { ...base, kind: "acute" }
    : null;
};
