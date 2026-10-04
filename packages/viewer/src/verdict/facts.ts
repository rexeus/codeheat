import type { Report } from "@codeheat/engine";

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

/** How many entry points the hero shows and the verdict sums up. */
export const TOP_ENTRY_POINTS = 3;

/** How many of the measured territories leak, and where the line is. */
const leakFact = ({ measured, leaking, limit }: Leaks): VerdictFact => ({
  value: `${formatCount(leaking)} of ${formatCount(measured)}`,
  label:
    measured === 1
      ? `territory keeps less than ${formatShare(limit)} of its changes inside`
      : `territories keep less than ${formatShare(limit)} of their changes inside`,
  note: "",
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
    label: `of the change effort sits in the top ${places === 1 ? "place" : `${places} places`} to start`,
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

/** The trend of the share of changes that stay in one module, which is higher when the design holds. */
const trendFact = ({ erosion }: Report): VerdictFact => {
  const verdict = erosion?.verdict ?? "unknown";
  const locality = erosion?.locality ?? null;
  const significance = TREND_SIGNIFICANCE[verdict];
  return {
    value: TREND_WORDS[verdict],
    label: "over the last quarters",
    note:
      locality === null
        ? ""
        : `${formatShare(locality.from)} → ${formatShare(locality.to)} of changes stay in one module (higher is better${significance === "" ? "" : `; ${significance}`})`,
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
