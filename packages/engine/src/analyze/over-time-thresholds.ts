// Owns the limits of everything the report says over time, reported so
// consumers see them: which windows count, and how much must move.
import {
  MIN_EROSION_SHIFT,
  MIN_EROSION_SIGMAS,
} from "../erosion/shift-gate.js";
import { MIN_TREND_WINDOWS } from "../erosion/trend-line.js";
import { HOT_TOP_SHARE } from "../heat/hot-files.js";
import { MIN_WINDOW_CHANGES } from "../series/active-window.js";

export const OVER_TIME_THRESHOLDS = {
  minWindowChanges: MIN_WINDOW_CHANGES,
  minTrendWindows: MIN_TREND_WINDOWS,
  minErosionShift: MIN_EROSION_SHIFT,
  minErosionSigmas: MIN_EROSION_SIGMAS,
  hotTopShare: HOT_TOP_SHARE,
};
