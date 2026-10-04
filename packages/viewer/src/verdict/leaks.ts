import type { Report } from "@codeheat/engine";

import { isRealTerritory } from "../territories/territory-index.js";
import type { TerritoryIndex } from "../territories/territory-index.js";

/** How many real territories were measured, how many of them leak, and the share of the heat that sits in the leaking ones. */
export type Leaks = {
  readonly measured: number;
  readonly leaking: number;
  /** 0..1 */
  readonly heatShare: number;
  /** The share of its changes a territory needs to keep inside to not leak. */
  readonly limit: number;
};

/**
 * Reads the territories at the recommended detail that are real parts of the
 * design (packages, folders, groups; not buckets or test code) and have counted
 * changes: a territory leaks when fewer than `thresholds.maxEntryContainment`
 * of its changes stay inside. `null` without a measured territory.
 */
export const leaksOf = (
  report: Report,
  territories: TerritoryIndex,
): Leaks | null => {
  const measured = territories.recommended.flatMap((territory) => {
    const containment = territory.fit?.containment ?? null;
    return isRealTerritory(territory) && containment !== null
      ? [{ containment, heat: territory.heatShare }]
      : [];
  });
  const total = measured.reduce((sum, { heat }) => sum + heat, 0);
  if (total === 0) {
    return null;
  }
  const limit = report.thresholds.maxEntryContainment;
  const leaking = measured.filter(({ containment }) => containment < limit);
  return {
    measured: measured.length,
    leaking: leaking.length,
    heatShare: leaking.reduce((sum, { heat }) => sum + heat, 0) / total,
    limit,
  };
};
