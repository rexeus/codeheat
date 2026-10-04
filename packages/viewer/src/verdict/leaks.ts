import type { Report } from "@codeheat/engine";

import { standingOf } from "../territories/judgement.js";
import { isRealTerritory } from "../territories/territory-index.js";
import type {
  Territory,
  TerritoryIndex,
} from "../territories/territory-index.js";

/** A real territory with enough changes to judge, and how it holds up. */
type JudgedTerritory = {
  readonly territory: Territory;
  readonly containment: number;
  readonly leaks: boolean;
};

/** Which real territories were judged, which of them leak, and how much of the repository's change effort each group holds. */
export type Leaks = {
  /** The judged territories, hottest first. */
  readonly judged: readonly JudgedTerritory[];
  readonly leaking: number;
  /** The share of all the repository's heat held by the leaking territories, 0..1. */
  readonly heatShare: number;
  /** The share of all the repository's heat held by the judged territories, leaking or not, 0..1. */
  readonly coverage: number;
};

const heatOf = (group: readonly JudgedTerritory[]): number =>
  group.reduce((sum, { territory }) => sum + territory.heatShare, 0);

/**
 * Reads the territories at the recommended detail that are real parts of the
 * design (packages, folders, groups; not buckets or test code) and that
 * `standingOf` can judge: enough counted changes, and a partner where they
 * leak (the engine's gate for a boundary entry). A territory's `heatShare` is
 * already its part of all the heat, so the sums are shares of the repository,
 * not of the judged territories alone. `null` without a judged territory.
 */
export const leaksOf = (
  report: Report,
  territories: TerritoryIndex,
): Leaks | null => {
  const judged = territories.recommended
    .filter((territory) => isRealTerritory(territory))
    .flatMap((territory): JudgedTerritory[] => {
      const standing = standingOf(territory, report.thresholds);
      return standing.kind === "unjudged"
        ? []
        : [
            {
              territory,
              containment: standing.containment,
              leaks: standing.kind === "leaks",
            },
          ];
    })
    .toSorted(
      (one, other) => other.territory.heatShare - one.territory.heatShare,
    );
  if (judged.length === 0) {
    return null;
  }
  const leaking = judged.filter(({ leaks }) => leaks);
  return {
    judged,
    leaking: leaking.length,
    heatShare: heatOf(leaking),
    coverage: heatOf(judged),
  };
};
