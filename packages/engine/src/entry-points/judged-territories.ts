import type { TerritoryFit } from "../model/territory-fit.js";
// Owns which territories entry points judge: the real ones at the recommended
// detail with enough changes to say anything.
import type { Territories, Territory } from "../model/territory.js";
import { isTerritoryKind } from "../territories/recommend.js";

/**
 * A territory with its design fit and the share of all the production code's
 * heat it holds (`codeHeatShares`), which the entry points rank and gate on:
 * `Territory.heatShare` counts test code too.
 */
export type Judged = Territory & {
  readonly fit: TerritoryFit;
  readonly codeHeatShare: number;
};

/** Whether at least `minChronicShare` of the territory's heat is the long-lived kind (`Thresholds.minEntryChronicShare`). */
export const isChronic = (
  { chronicShare }: TerritoryFit,
  minChronicShare: number,
): boolean => chronicShare >= minChronicShare;

/**
 * The territories visible at the recommended detail that are packages,
 * folders, or groups (never a bucket, loose files, or test-only code), have a
 * fit, and at least `minChanges` counted changes, in the order of the detail;
 * `codeHeat` gives each territory's share of the production code's heat.
 */
export const judgedTerritories = (
  { recommended, details, nodes }: Territories,
  minChanges: number,
  codeHeat: ReadonlyMap<string, number>,
): ReadonlyArray<Judged> => {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const visible = details.find(({ level }) => level === recommended)?.ids ?? [];
  return visible.flatMap((id) => {
    const node = byId.get(id);
    return node !== undefined &&
      node.fit !== null &&
      isTerritoryKind(node.kind) &&
      node.changes >= minChanges
      ? [{ ...node, fit: node.fit, codeHeatShare: codeHeat.get(id) ?? 0 }]
      : [];
  });
};
