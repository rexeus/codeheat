// Owns where a boundary entry says its territory leaks to: the territory
// its changes reach into most, or, for a boundary between two territories,
// that they leak into each other.
import type { Report } from "@codeheat/engine";

import { territoryName } from "../territories/territory-index.js";
import type {
  Territory,
  TerritoryIndex,
} from "../territories/territory-index.js";

type EntryPoint = Report["entryPoints"][number];

/** The territory a boundary's changes reach into most, from the fit of the territory; or two territories that reach into each other. */
export type LeakTarget = {
  /** The other territory, or both territories joined with "and" when they leak into each other. */
  readonly name: string;
  /** Counted changes that touched both territories. */
  readonly sharedChanges: number;
  /** Share of the territory's changes that also touched the other, 0..1; of the changes that touched either, for two territories. */
  readonly share: number;
  /** Whether two territories leak into each other, so that `name` names both. */
  readonly mutual: boolean;
};

const leaksBothWays = (
  { evidence }: EntryPoint,
  territories: readonly Territory[],
): LeakTarget | null => {
  const [first, second] = territories;
  const { sharedChanges, partnerShare } = evidence;
  return territories.length === 2 &&
    first !== undefined &&
    second !== undefined &&
    sharedChanges !== undefined &&
    partnerShare !== undefined
    ? {
        name: `${territoryName(first)} and ${territoryName(second)}`,
        sharedChanges,
        share: partnerShare,
        mutual: true,
      }
    : null;
};

/**
 * Where the boundary of the entry's one territory leaks to: the territory it
 * changes with most. For a boundary between two territories (its evidence
 * counts `sharedChanges`), that they leak into each other, with the changes
 * that touched both. `null` for an entry that is no boundary, and where the
 * territory names no partner.
 */
export const leakTargetOf = (
  entry: EntryPoint,
  territories: readonly Territory[],
  index: TerritoryIndex,
): LeakTarget | null => {
  const isBoundary =
    entry.kind === "boundary" ||
    entry.findings.some(({ kind }) => kind === "boundary");
  const partner = territories[0]?.fit?.partner ?? null;
  if (!isBoundary) {
    return null;
  }
  if (territories.length !== 1 || partner === null) {
    return leaksBothWays(entry, territories);
  }
  const other =
    index.visibleOf(partner.territory) ?? index.byId.get(partner.territory);
  return other === undefined
    ? null
    : {
        name: territoryName(other),
        sharedChanges: partner.sharedChanges,
        share: partner.share,
        mutual: false,
      };
};
