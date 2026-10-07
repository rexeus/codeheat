import type { Report } from "@codeheat/engine";

/** Which way the design moves, for an arrow beside the words. */
export type TrendDirection = "worse" | "better" | "steady" | "none";

export type Trend = {
  readonly direction: TrendDirection;
  readonly label: string;
};

const TRENDS = {
  eroding: { direction: "worse", label: "Getting worse" },
  improving: { direction: "better", label: "Getting better" },
  holding: { direction: "steady", label: "Holding steady" },
  unknown: { direction: "none", label: "No trend yet" },
} as const satisfies Record<string, Trend>;

/**
 * How much of their changes the territories the verdict judges kept inside
 * over the last quarters (`verdict.trend`), the trend that lowers the
 * verdict's level when it erodes. The engine calls a trend only from
 * `thresholds.minVerdictWindows` quarters with enough changes on; with judged
 * territories but fewer quarters it says so.
 */
export const trendOf = ({ verdict }: Report): Trend =>
  verdict.trend === "unknown" && verdict.judged.length > 0
    ? { direction: "none", label: "Too few quarters to call a trend" }
    : TRENDS[verdict.trend];
