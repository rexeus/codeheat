import type { Report } from "@codeheat/engine";

import { judgeTerritory } from "../territories/judgement.js";
import { isRealTerritory } from "../territories/territory-index.js";
import type { TerritoryIndex } from "../territories/territory-index.js";

/** How many real territories were judged, how many of them leak, and how much of the repository's change effort each group holds. */
export type Leaks = {
  readonly measured: number;
  readonly leaking: number;
  /** The share of all the repository's heat held by the leaking territories, 0..1: the denominator of the fit map's tiles. */
  readonly heatShare: number;
  /** The share of all the repository's heat held by the judged territories, leaking or not, 0..1. */
  readonly coverage: number;
  /** A territory leaks when at most this share of its changes stay inside and it has a partner (the engine's boundary gate). */
  readonly limit: number;
  /** How many counted changes a territory needs to be judged. */
  readonly minChanges: number;
};

const heatOf = (group: readonly { readonly heat: number }[]): number =>
  group.reduce((sum, { heat }) => sum + heat, 0);

/**
 * Reads the territories at the recommended detail that are real parts of the
 * design (packages, folders, groups; not buckets or test code) and have enough
 * counted changes to be judged (`thresholds.minModuleCommits`). A territory
 * leaks when at most `thresholds.maxEntryContainment` of its changes stay
 * inside and another territory shares changes with it (`fit.partner`): the
 * engine's gate for a boundary entry, since a verdict on a boundary needs
 * evidence of where it leaks to. A territory that keeps little inside but has
 * no partner says nothing either way, so it is left out of the judged ones. A
 * territory's `heatShare` is already its part of all the heat, so the sums are
 * shares of the repository, not of the judged territories alone. `null`
 * without a judged territory.
 */
export const leaksOf = (
  report: Report,
  territories: TerritoryIndex,
): Leaks | null => {
  const limit = report.thresholds.maxEntryContainment;
  const judged = territories.recommended.flatMap((territory) => {
    const { containment } = judgeTerritory(territory, report.thresholds);
    if (!isRealTerritory(territory) || containment === null) {
      return [];
    }
    const leaks = containment <= limit;
    const hasLeakTarget = (territory.fit?.partner ?? null) !== null;
    return leaks && !hasLeakTarget
      ? []
      : [{ leaks, heat: territory.heatShare }];
  });
  if (judged.length === 0) {
    return null;
  }
  const leaking = judged.filter(({ leaks }) => leaks);
  return {
    measured: judged.length,
    leaking: leaking.length,
    heatShare: heatOf(leaking),
    coverage: heatOf(judged),
    limit,
    minChanges: report.thresholds.minModuleCommits,
  };
};
