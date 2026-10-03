// Owns which territories entry points judge: the real ones at the recommended
// detail with enough changes to say anything.
import type { TerritoryFit } from "../report/territory-fit.js";
import type { Territories, Territory } from "../report/territory.js";

/** A territory with its design fit. */
export type Judged = Territory & { readonly fit: TerritoryFit };

/** Share of its code's heat in chronic hotspots at which a territory counts as chronic. */
const CHRONIC_SHARE = 0.5;

/** Whether most of the territory's heat is the long-lived kind. */
export const isChronic = ({ chronicShare }: TerritoryFit): boolean =>
  chronicShare >= CHRONIC_SHARE;

/**
 * The territories visible at the recommended detail that are packages,
 * folders, or groups (never a bucket, loose files, or test-only code), have a
 * fit, and at least `minChanges` counted changes, in the order of the detail.
 */
export const judgedTerritories = (
  { recommended, details, nodes }: Territories,
  minChanges: number,
): ReadonlyArray<Judged> => {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const visible = details.find(({ level }) => level === recommended)?.ids ?? [];
  return visible.flatMap((id) => {
    const node = byId.get(id);
    return node !== undefined &&
      node.fit !== null &&
      (node.kind === "package" ||
        node.kind === "folder" ||
        node.kind === "group") &&
      node.changes >= minChanges
      ? [{ ...node, fit: node.fit }]
      : [];
  });
};
