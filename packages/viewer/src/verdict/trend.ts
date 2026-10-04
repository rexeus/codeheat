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
 * How the share of changes that stay in one module moved over the last
 * quarters (`erosion.verdict`). The engine calls a trend only from
 * `thresholds.minVerdictWindows` quarters on; with fewer it says so.
 */
export const trendOf = ({ erosion, thresholds }: Report): Trend => {
  const verdict = erosion?.verdict ?? "unknown";
  if (
    verdict !== "unknown" &&
    (erosion?.windows ?? 0) < thresholds.minVerdictWindows
  ) {
    return { direction: "none", label: "Too few quarters to call a trend" };
  }
  return TRENDS[verdict];
};
