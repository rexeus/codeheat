// Owns reading the territories of a report as partitions: which territories
// are visible at a detail, which one holds each file there, and the detail at
// which each territory is measured.
import type { Territories, Territory } from "../model/territory.js";

/** The territories visible at one detail and where every file lies among them. */
export type Level = {
  readonly detail: number;
  readonly areas: ReadonlyArray<Territory>;
  /** The id of the visible territory that holds each file. */
  readonly areaOfFile: ReadonlyMap<string, string>;
};

/**
 * The detail at which each territory is measured: of the details that show
 * it, the one closest to the recommended detail (a territory is visible at
 * consecutive details, so there is one). A territory no detail shows (the
 * root) has none.
 */
export const homeDetails = ({
  recommended,
  details,
}: Territories): ReadonlyMap<string, number> => {
  const homes = new Map<string, number>();
  for (const { level, ids } of details) {
    for (const id of ids) {
      const known = homes.get(id);
      const distance = Math.abs(level - recommended);
      const knownDistance =
        known === undefined ? Infinity : Math.abs(known - recommended);
      if (distance < knownDistance) {
        homes.set(id, level);
      }
    }
  }
  return homes;
};

/**
 * The partition `territories` makes at `detail`, over the files that name
 * their finest territory in `fileTerritories` (path to id).
 */
export const levelAt = (
  territories: Territories,
  detail: number,
  fileTerritories: ReadonlyMap<string, string>,
): Level => {
  const byId = new Map(territories.nodes.map((node) => [node.id, node]));
  const visible = new Set(
    territories.details.find(({ level }) => level === detail)?.ids ?? [],
  );
  const climbed = new Map<string, string | undefined>();
  const visibleAbove = (id: string): string | undefined => {
    if (visible.has(id)) {
      return id;
    }
    if (!climbed.has(id)) {
      const parent = byId.get(id)?.parent;
      climbed.set(
        id,
        parent === null || parent === undefined
          ? undefined
          : visibleAbove(parent),
      );
    }
    return climbed.get(id);
  };
  const areaOfFile = new Map<string, string>();
  for (const [file, id] of fileTerritories) {
    const area = visibleAbove(id);
    if (area !== undefined) {
      areaOfFile.set(file, area);
    }
  }
  return {
    detail,
    areas: territories.nodes.filter(({ id }) => visible.has(id)),
    areaOfFile,
  };
};
