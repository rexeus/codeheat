import type { Analysis } from "@codeheat/engine";

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
};

/**
 * The territories the engine judged for the verdict (`Analysis.verdict`:
 * `judged` and `leaking`, hottest first), each with how much of its changes
 * stay inside. A territory's `heatShare` is already its part of all the heat,
 * so the shares are of the repository, not of the judged territories alone.
 * `null` without a judged territory.
 */
export const leaksOf = (
  { verdict }: Analysis,
  territories: TerritoryIndex,
): Leaks | null => {
  const leaking = new Set(verdict.leaking);
  const judged = verdict.judged.flatMap((id): JudgedTerritory[] => {
    const territory = territories.byId.get(id);
    const containment = territory?.fit?.containment ?? null;
    return territory === undefined || containment === null
      ? []
      : [{ territory, containment, leaks: leaking.has(id) }];
  });
  if (judged.length === 0) {
    return null;
  }
  return {
    judged,
    leaking: judged.filter(({ leaks }) => leaks).length,
    heatShare: verdict.leakShare,
  };
};
