// Owns the detail to read first: the finest with few enough territories that
// hides no folder hotter than a territory opened beside it.
import type { Territory } from "../report/territory.js";
import type { FlatNode } from "./flatten-tree.js";
import { heatOf } from "./part.js";
import type { Evidence } from "./part.js";

/** Territories at the recommended detail number at most this many. */
const RECOMMENDED_MAX_TERRITORIES = 25;

/** What the recommendation reads of a visible node. */
type Visible = Pick<Territory, "id" | "kind" | "parent" | "heatShare">;

export const isTerritoryKind = (kind: Territory["kind"]): boolean =>
  kind === "package" || kind === "folder" || kind === "group";

/**
 * For each bucket of smaller folders that no split opened, the share of all
 * heat of its hottest folder, by the id of the bucket's node.
 */
export const hiddenHeat = (
  flat: ReadonlyArray<FlatNode>,
  evidence: Evidence,
): ReadonlyMap<string, number> =>
  new Map(
    flat
      .filter(
        ({ node }) => node.part.kind === "more" && node.children.length === 0,
      )
      .map(({ id, node }) => [
        id,
        evidence.totalHeat === 0
          ? 0
          : Math.max(
              0,
              ...node.part.members.map((member) =>
                heatOf(evidence, member.files),
              ),
            ) / evidence.totalHeat,
      ]),
  );

/** A bucket of the detail hides a folder hotter than the coolest territory opened beside it. */
const hidesHotterFolder = (
  visible: ReadonlyArray<Visible>,
  hidden: ReadonlyMap<string, number>,
): boolean =>
  visible.some((bucket) => {
    const siblings = visible.filter(
      (node) => node.parent === bucket.parent && isTerritoryKind(node.kind),
    );
    return (
      bucket.kind === "other" &&
      siblings.length > 0 &&
      (hidden.get(bucket.id) ?? 0) >
        Math.min(...siblings.map(({ heatShare }) => heatShare))
    );
  });

/**
 * The detail to read first: the finest with at most 25 territories (buckets
 * and test-only code do not count) whose buckets hide no folder hotter than a
 * territory opened beside them. When no such detail has few enough
 * territories, the first finer one that hides nothing, else the finest with
 * few enough; the first detail when even that has more.
 */
export const recommendedOf = (
  details: ReadonlyArray<ReadonlyArray<Visible>>,
  hidden: ReadonlyMap<string, number>,
): number => {
  const fits = details.map(
    (visible) =>
      visible.filter(({ kind }) => isTerritoryKind(kind)).length <=
      RECOMMENDED_MAX_TERRITORIES,
  );
  const clean = details.map((visible) => !hidesHotterFolder(visible, hidden));
  const finestFit = fits.lastIndexOf(true);
  const cleanFit = details.findLastIndex(
    (_, at) => fits[at] === true && clean[at] === true,
  );
  const finer = clean.findIndex((isClean, at) => isClean && at > finestFit);
  const found = cleanFit >= 0 ? cleanFit : finer;
  return 1 + Math.max(0, found >= 0 ? found : finestFit);
};
