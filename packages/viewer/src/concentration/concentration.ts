// Owns the answer to "where does change concentrate?": how much of the
// change effort the hottest territories hold.
import type { Report } from "@codeheat/engine";

import { distinctNameParts } from "../territories/distinct-names.js";
import { standingOf } from "../territories/judgement.js";
import type { Standing } from "../territories/judgement.js";
import {
  isRealTerritory,
  NO_REAL_TERRITORY,
} from "../territories/territory-index.js";
import type {
  NameParts,
  TerritoryIndex,
} from "../territories/territory-index.js";

/** One territory with its share of the change effort and how it holds up. */
export type HeatRow = {
  readonly id: string;
  readonly name: NameParts;
  /** Its share of all the heat, 0..1. */
  readonly heatShare: number;
  readonly standing: Standing;
};

export type Concentration =
  | { readonly kind: "none"; readonly note: string }
  | {
      readonly kind: "some";
      /** How many territories the headline sums up: three, or all when there are fewer. */
      readonly top: number;
      /** The share of all the heat those hold. */
      readonly topShare: number;
      /** Every real territory at the recommended detail, hottest first. */
      readonly rows: readonly HeatRow[];
      /** The share of the heat outside them: test code and leftover files. */
      readonly elsewhere: number;
    };

/** How many of the hottest territories the headline sums up. */
const TOP_TERRITORIES = 3;

const NO_TERRITORIES =
  "This report has no territories; analyze again with a current codeheat.";

const NO_HEAT =
  "Nothing changed in this window, so change concentrates nowhere.";

const sumOf = (shares: readonly number[]): number =>
  shares.reduce((sum, share) => sum + share, 0);

/**
 * The real territories (packages, folders, groups) at the recommended
 * detail, hottest first, and the share of all the heat the three hottest
 * hold. Test code and leftover files are change effort too, but no part of
 * the design: they count in the total, not as a territory. Says so plainly
 * when the report has no territories, no real one, or no change effort.
 */
export const concentrationOf = (
  report: Report,
  index: TerritoryIndex,
): Concentration => {
  if (index.recommended.length === 0) {
    return { kind: "none", note: NO_TERRITORIES };
  }
  const nameOf = distinctNameParts(index.recommended);
  const rows = index.recommended
    .filter((territory) => isRealTerritory(territory))
    .toSorted((one, other) => other.heatShare - one.heatShare)
    .map((territory) => ({
      id: territory.id,
      name: nameOf(territory),
      heatShare: territory.heatShare,
      standing: standingOf(territory, report.thresholds),
    }));
  if (rows.length === 0) {
    return { kind: "none", note: NO_REAL_TERRITORY };
  }
  const total = sumOf(index.recommended.map(({ heatShare }) => heatShare));
  if (total === 0 || rows.every(({ heatShare }) => heatShare === 0)) {
    return { kind: "none", note: NO_HEAT };
  }
  const top = Math.min(TOP_TERRITORIES, rows.length);
  return {
    kind: "some",
    top,
    topShare: sumOf(rows.slice(0, top).map(({ heatShare }) => heatShare)),
    rows,
    elsewhere: Math.max(
      0,
      total - sumOf(rows.map(({ heatShare }) => heatShare)),
    ),
  };
};
