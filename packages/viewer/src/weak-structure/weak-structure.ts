// Owns the answer to "where is the structure weak?": the territories whose
// boundaries leak, by the same rule as the verdict and the engine's
// boundary entries.
import type { Report } from "@codeheat/engine";

import { distinctNameParts } from "../territories/distinct-names.js";
import {
  isRealTerritory,
  NO_REAL_TERRITORY,
} from "../territories/territory-index.js";
import type {
  NameParts,
  TerritoryIndex,
} from "../territories/territory-index.js";
import { leaksOf } from "../verdict/leaks.js";

/** A judged territory: how much of its change stays inside, and where it reaches most. */
export type BoundaryRow = {
  readonly id: string;
  readonly name: NameParts;
  readonly heatShare: number;
  readonly containment: number;
  readonly leaks: boolean;
  /** The territory its changes reach into most, and the share of its changes that do; `null` when none shares enough. */
  readonly partner: { readonly name: string; readonly share: number } | null;
};

export type WeakStructure =
  | { readonly kind: "none"; readonly note: string }
  | {
      readonly kind: "some";
      readonly leaking: number;
      /** The share of all the heat in the leaking territories. */
      readonly leakShare: number;
      /** A territory leaks at or below this share of changes kept inside. */
      readonly limit: number;
      /** The judged territories, hottest first. */
      readonly rows: readonly BoundaryRow[];
      /** Real territories left out for too few changes or no partner. */
      readonly unjudged: number;
    };

const NO_TERRITORIES =
  "This report has no territories; analyze again with a current codeheat.";

/**
 * The real territories at the recommended detail with enough counted
 * changes to judge (`thresholds.minModuleCommits`), and which of them leak:
 * at most `thresholds.maxEntryContainment` of their changes stay inside, and
 * another territory shares changes with them. Says so plainly when the
 * report has no territories, no real one, or none that can be judged.
 */
export const weakStructureOf = (
  report: Report,
  index: TerritoryIndex,
): WeakStructure => {
  if (index.recommended.length === 0) {
    return { kind: "none", note: NO_TERRITORIES };
  }
  const real = index.recommended.filter((territory) =>
    isRealTerritory(territory),
  ).length;
  if (real === 0) {
    return { kind: "none", note: NO_REAL_TERRITORY };
  }
  const leaks = leaksOf(report, index);
  if (leaks === null) {
    return {
      kind: "none",
      note: `No territory has enough changes to judge: it takes ${report.thresholds.minModuleCommits} counted changes and a partner to leak to, and test code is not judged.`,
    };
  }
  const nameOf = distinctNameParts(index.recommended);
  const partnerName = (id: string): string => {
    const partner = index.visibleOf(id) ?? index.byId.get(id);
    return partner === undefined ? id : nameOf(partner).base;
  };
  const rows = leaks.judged.map(({ territory, containment, leaks: leaky }) => {
    const partner = territory.fit?.partner ?? null;
    return {
      id: territory.id,
      name: nameOf(territory),
      heatShare: territory.heatShare,
      containment,
      leaks: leaky,
      partner:
        partner === null
          ? null
          : { name: partnerName(partner.territory), share: partner.share },
    };
  });
  return {
    kind: "some",
    leaking: leaks.leaking,
    leakShare: leaks.heatShare,
    limit: report.thresholds.maxEntryContainment,
    rows,
    unjudged: real - rows.length,
  };
};
