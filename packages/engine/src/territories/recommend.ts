// Owns the detail to read first: the finest with few enough territories whose
// buckets hide no folder hotter than a territory opened beside them.
import type { Territory } from "../report/territory.js";
import type { FlatNode } from "./flatten-tree.js";
import { directoriesOf, heatOf } from "./part.js";
import type { Evidence, Part } from "./part.js";

/** Territories at the recommended detail number at most this many. */
const RECOMMENDED_MAX_TERRITORIES = 25;

/**
 * What the recommendation reads of a node shown at a detail, in one measure
 * (the evidence's heat, as a share of all heat, unrounded).
 */
export type Shown = {
  readonly kind: Territory["kind"];
  /** `id` of the node it splits from. */
  readonly parent: string | null;
  /** Its own share of the heat. */
  readonly share: number;
  /** The share of the hottest folder it holds without showing it; 0 for a node that holds none. */
  readonly hidden: number;
};

export const isTerritoryKind = (kind: Territory["kind"]): boolean =>
  kind === "package" || kind === "folder" || kind === "group";

/** The folder a file lies in below `base`, by the folder's first directory; undefined for a file directly in `base`. */
const folderBelow = (base: string, file: string): string | undefined => {
  const relative = base === "" ? file : file.slice(base.length + 1);
  const slash = relative.indexOf("/");
  return slash < 0
    ? undefined
    : `${base === "" ? "" : `${base}/`}${relative.slice(0, slash)}`;
};

/**
 * The share of all heat of the hottest folder a bucket or a node of loose
 * files holds: its files grouped by the folder below the directory they sit
 * in, whether that folder is one of the bucket's members or has too few files
 * to be a territory. Files directly in the directory are no folder.
 */
const hiddenShare = (part: Part, evidence: Evidence): number => {
  if (evidence.totalHeat === 0) {
    return 0;
  }
  const folders = new Map<string, Array<string>>();
  for (const file of part.files) {
    const folder = folderBelow(part.base, file);
    if (folder !== undefined) {
      const inside = folders.get(folder) ?? [];
      inside.push(file);
      folders.set(folder, inside);
    }
  }
  return (
    Math.max(
      0,
      ...[...folders].map(([folder, files]) =>
        heatOf(evidence, files, [folder]),
      ),
    ) / evidence.totalHeat
  );
};

/** What the recommendation reads of each node, by its `id`. */
export const shownOf = (
  flat: ReadonlyArray<FlatNode>,
  evidence: Evidence,
): ReadonlyMap<string, Shown> =>
  new Map(
    flat.map(({ id, kind, parent, node }) => [
      id,
      {
        kind,
        parent: parent === null ? null : (flat[parent]?.id ?? null),
        share:
          evidence.totalHeat === 0
            ? 0
            : heatOf(evidence, node.part.files, directoriesOf(node.part)) /
              evidence.totalHeat,
        hidden: kind === "other" ? hiddenShare(node.part, evidence) : 0,
      },
    ]),
  );

/** A bucket or node of loose files of the detail holds a folder hotter than the coolest territory opened beside it. */
const hidesHotterFolder = (visible: ReadonlyArray<Shown>): boolean =>
  visible.some((bucket) => {
    const siblings = visible.filter(
      (node) => node.parent === bucket.parent && isTerritoryKind(node.kind),
    );
    return (
      siblings.length > 0 &&
      bucket.hidden > Math.min(...siblings.map(({ share }) => share))
    );
  });

/**
 * The detail to read first: the finest with at most 25 territories (buckets,
 * loose files, and test-only code do not count) in which no bucket or node of
 * loose files holds a folder hotter than the coolest territory opened beside
 * it, whether the folder has a bucket slot or too few files to be a territory.
 * When every detail with few enough territories hides such a folder, the
 * finest of them, and its buckets are reported as they are; the first detail
 * when even that has more than 25 territories.
 */
export const recommendedOf = (
  details: ReadonlyArray<ReadonlyArray<Shown>>,
): number => {
  const fits = details.map(
    (visible) =>
      visible.filter(({ kind }) => isTerritoryKind(kind)).length <=
      RECOMMENDED_MAX_TERRITORIES,
  );
  const cleanFit = details.findLastIndex(
    (visible, at) => fits[at] === true && !hidesHotterFolder(visible),
  );
  return 1 + Math.max(0, cleanFit >= 0 ? cleanFit : fits.lastIndexOf(true));
};
