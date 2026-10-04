import { h, withFlags } from "../render/dom.js";
import type { Verdict, VerdictLevel } from "../verdict/derive-verdict.js";
import type { Trend, TrendDirection } from "../verdict/trend.js";
import { icon } from "./icon.js";
import type { IconName } from "./icon.js";

/** The icon beside a level's name; the name says it, the icon and the color only repeat it. */
const VERDICT_ICONS: Record<VerdictLevel, IconName> = {
  holds: "shield",
  mixed: "leak",
  strained: "leak",
  unknown: "scale",
};

const TREND_ICONS: Record<TrendDirection, IconName> = {
  worse: "worse",
  better: "better",
  steady: "steady",
  none: "steady",
};

/**
 * Fills the line beside the question: the verdict as a badge, the trend, and,
 * when there is no verdict, why not and what to try.
 */
export const renderHeadline = (
  {
    badge,
    trend: trendLine,
    reason,
  }: {
    readonly badge: HTMLElement;
    readonly trend: HTMLElement;
    readonly reason: HTMLElement;
  },
  verdict: Verdict,
  trend: Trend,
): void => {
  badge.dataset["level"] = verdict.level;
  badge.replaceChildren(icon(VERDICT_ICONS[verdict.level]), verdict.label);
  trendLine.dataset["direction"] = trend.direction;
  trendLine.replaceChildren(icon(TREND_ICONS[trend.direction]), trend.label);
  reason.hidden = verdict.reason === "";
  reason.replaceChildren(
    verdict.reason,
    ...(verdict.note === ""
      ? []
      : [" ", h("span", "verdict-note", ...withFlags(verdict.note))]),
  );
};
