import type { Report } from "@codeheat/engine";

import { TOP_ENTRY_POINTS } from "../entry-points/entry-views.js";
import { formatCount, formatShare } from "../render/format.js";
import type { TerritoryIndex } from "../territories/territory-index.js";
import type { Leaks } from "./leaks.js";

/** One number behind the verdict, in plain words. */
export type VerdictFact = {
  readonly value: string;
  readonly label: string;
  /** A second line with the detail; empty when there is none. */
  readonly note: string;
};

/** How many of the judged territories leak, where the line is, and what judged means. */
const leakFact = ({
  measured,
  leaking,
  limit,
  minChanges,
}: Leaks): VerdictFact => ({
  value: `${formatCount(leaking)} of ${formatCount(measured)}`,
  label:
    measured === 1
      ? `territory with enough changes keeps at most ${formatShare(limit)} of its changes inside`
      : `territories with enough changes keep at most ${formatShare(limit)} of their changes inside`,
  note: `enough: at least ${formatCount(minChanges)} counted changes`,
});

/** The share of the change effort that the top entry points' territories hold; `null` without any. */
const startFact = (
  report: Report,
  territories: TerritoryIndex,
): VerdictFact | null => {
  const holders = new Map(
    report.entryPoints
      .slice(0, TOP_ENTRY_POINTS)
      .flatMap(({ territories: ids }) => ids)
      .flatMap((id) => territories.visibleOf(id) ?? [])
      .map((territory) => [territory.id, territory.heatShare]),
  );
  if (holders.size === 0) {
    return null;
  }
  const share = Math.min(
    1,
    [...holders.values()].reduce((sum, heat) => sum + heat, 0),
  );
  const places = Math.min(TOP_ENTRY_POINTS, report.entryPoints.length);
  return {
    value: formatShare(share),
    label: `of the change effort sits in the territories of the top ${places === 1 ? "place" : `${places} places`} to start`,
    note: "",
  };
};

const TREND_WORDS = {
  eroding: "Getting worse",
  improving: "Getting better",
  holding: "Holding steady",
  unknown: "No trend yet",
} as const;

/** What the trend line's size means, in the engine's terms: it only counts as a trend when it is significant. */
const TREND_SIGNIFICANCE = {
  eroding: "this fall is significant",
  improving: "this rise is significant",
  holding: "the shift is not significant",
  unknown: "",
} as const;

type Erosion = NonNullable<Report["erosion"]>;

/** The line of the trend in words, with what a higher share means and, where the engine called it, how significant the shift is. */
const rangeOf = (
  locality: Erosion["locality"],
  significance: string,
): string => {
  if (locality === null) {
    return "";
  }
  const aside = significance === "" ? "" : `; ${significance}`;
  return `${formatShare(locality.from)} → ${formatShare(locality.to)} of changes stay in one module (higher is better${aside})`;
};

/**
 * The trend of the share of changes that stay in one module, which is higher
 * when the design holds. The engine calls a trend only from
 * `thresholds.minVerdictWindows` quarters on; with fewer the line is shown
 * with its numbers and no verdict.
 */
const trendFact = ({ erosion, thresholds }: Report): VerdictFact => {
  const verdict = erosion?.verdict ?? "unknown";
  const windows = erosion?.windows ?? 0;
  const locality = erosion?.locality ?? null;
  if (verdict !== "unknown" && windows < thresholds.minVerdictWindows) {
    return {
      value: "Too few quarters to call a trend",
      label: `${formatCount(windows)} of the ${formatCount(thresholds.minVerdictWindows)} quarters needed`,
      note: rangeOf(locality, ""),
    };
  }
  return {
    value: TREND_WORDS[verdict],
    label: "over the last quarters",
    note: rangeOf(locality, TREND_SIGNIFICANCE[verdict]),
  };
};

const propagationFact = ({ propagationCost }: Report): VerdictFact[] =>
  propagationCost === null
    ? []
    : [
        {
          value: formatShare(propagationCost.cost),
          label: "of the code a change drags along (propagation cost)",
          note: `through chains of couplings, over ${formatCount(propagationCost.files)} files`,
        },
      ];

/**
 * The numbers behind the verdict, all about territories or the repository as a
 * whole: how many territories leak, what the top places to start hold, the
 * trend, and the propagation cost. What the report does not measure is left out.
 */
export const factsOf = (
  report: Report,
  territories: TerritoryIndex,
  leaks: Leaks | null,
): VerdictFact[] => {
  const start = startFact(report, territories);
  return [
    ...(leaks === null ? [] : [leakFact(leaks)]),
    ...(start === null ? [] : [start]),
    trendFact(report),
    ...propagationFact(report),
  ];
};
