// Owns what the fit map draws: one tile per territory at the recommended
// detail, with its area, its color step, its label, and the places to start
// that concern it.
import { cohesionStep } from "../color/cohesion-scale.js";
import type { EntryView } from "../entry-points/entry-views.js";
import { formatShare } from "../render/format.js";
import { territoryName, territoryNameParts } from "./territory-index.js";
import type {
  NameParts,
  Territory,
  TerritoryIndex,
} from "./territory-index.js";

export type FitTile = {
  readonly id: string;
  readonly name: string;
  /** The name split for a narrow tile: the folder it shares (with a trailing slash, or empty) and the part that tells it apart, which a narrow tile shows alone. */
  readonly nameParts: NameParts;
  /** What the territory is, in one line. */
  readonly description: string;
  readonly kind: Territory["kind"];
  /** Relative area of the tile. */
  readonly weight: number;
  /** The share of the change effort in the territory. */
  readonly heatShare: number;
  /** The share of its changes that touch no other territory; `null` without data. */
  readonly containment: number | null;
  /** Why a tile has no containment to color it by; `null` when it has one. */
  readonly noData: string | null;
  /** The color step (see `cohesionStep`): 0 no data, 1 leaks most, 6 holds best. */
  readonly step: number;
  /** The ranks of the places to start that concern it, best first. */
  readonly ranks: readonly number[];
  /** The tile in words, for readers who cannot see its size and color. */
  readonly summary: string;
};

/**
 * Area grows with the square root of the share of change effort: the hottest
 * territory does not crowd out the rest, and the smallest still get a tile
 * to read and to point at.
 */
const MIN_WEIGHT = 0.07;

const weightOf = (heatShare: number): number =>
  Math.max(Math.sqrt(heatShare), MIN_WEIGHT);

/** The ranks of the entries that concern each territory at the recommended detail. */
const ranksByTerritory = (
  entries: readonly EntryView[],
): Map<string, number[]> => {
  const ranks = new Map<string, number[]>();
  for (const { rank, territories } of entries) {
    for (const { id } of territories) {
      ranks.set(id, [...(ranks.get(id) ?? []), rank]);
    }
  }
  return ranks;
};

/** A bucket's description starts with its name, which the tile shows already; what follows says what is in it. */
const descriptionOf = (territory: Territory): string => {
  if (territory.kind !== "other") {
    return territory.description;
  }
  const cut = territory.description.indexOf("; ");
  return cut === -1 ? "" : territory.description.slice(cut + 2);
};

/** Why a territory has no containment: test code is not judged, anything else saw no counted change. */
const noDataReason = (kind: Territory["kind"]): string =>
  kind === "tests"
    ? "test code is not judged"
    : "no counted changes in this window";

const summaryOf = (
  name: string,
  containment: number | string,
  heatShare: number,
  ranks: readonly number[],
): string =>
  [
    name,
    typeof containment === "string"
      ? containment
      : `${formatShare(containment)} of its changes stay inside`,
    `${formatShare(heatShare)} of the change effort`,
    ranks.length === 0
      ? ""
      : `place to start ${ranks.map((rank) => `#${rank}`).join(", ")}`,
  ]
    .filter((part) => part !== "")
    .join("; ");

/** The tiles of the fit map, in the report's order; empty when the report has no territories. */
export const fitTilesOf = (
  index: TerritoryIndex,
  entries: readonly EntryView[],
): FitTile[] => {
  const ranks = ranksByTerritory(entries);
  return index.recommended.map((territory) => {
    const name = territoryName(territory);
    const containment = territory.fit?.containment ?? null;
    const own = ranks.get(territory.id) ?? [];
    const noData = containment === null ? noDataReason(territory.kind) : null;
    return {
      id: territory.id,
      name,
      nameParts: territoryNameParts(territory),
      description: descriptionOf(territory),
      kind: territory.kind,
      weight: weightOf(territory.heatShare),
      heatShare: territory.heatShare,
      containment,
      noData,
      step: cohesionStep(containment),
      ranks: own,
      summary: summaryOf(
        name,
        containment ?? noData ?? "",
        territory.heatShare,
        own,
      ),
    };
  });
};
