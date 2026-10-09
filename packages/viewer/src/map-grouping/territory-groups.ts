// Owns which territory holds each file at a detail, for grouping the map.
import type { FileStats, Analysis } from "@codeheat/engine";

import {
  isRealTerritory,
  territoryName,
} from "../territories/territory-index.js";
import type { Territory } from "../territories/territory-index.js";

type Territories = Analysis["territories"];

/** A territory visible at a detail with the files it holds, the report's own files only. */
export type Group = {
  readonly territory: Territory;
  readonly files: readonly FileStats[];
};

/** The ids of the territories visible at `level`; empty for a level the report does not have. */
export const visibleAt = (
  { details }: Territories,
  level: number,
): ReadonlySet<string> =>
  new Set(details.find((detail) => detail.level === level)?.ids ?? []);

/**
 * The files grouped by the territory that holds them at `level`, in the
 * report's order (real territories hottest first, then buckets); a territory without a listed file is left out. Each file names its
 * finest territory; this climbs to the one visible at `level`.
 */
export const groupFilesAt = (
  territories: Territories,
  files: readonly FileStats[],
  level: number,
): Group[] => {
  const byId = new Map(territories.nodes.map((node) => [node.id, node]));
  const visible = visibleAt(territories, level);
  const visibleOf = new Map<string, string | undefined>();
  const climb = (id: string): string | undefined => {
    if (!visibleOf.has(id)) {
      let current = byId.get(id);
      while (current !== undefined && !visible.has(current.id)) {
        current =
          current.parent === null ? undefined : byId.get(current.parent);
      }
      visibleOf.set(id, current?.id);
    }
    return visibleOf.get(id);
  };
  const held = new Map<string, FileStats[]>();
  for (const file of files) {
    const id = climb(file.territory);
    if (id !== undefined) {
      const own = held.get(id) ?? [];
      own.push(file);
      held.set(id, own);
    }
  }
  const order = territories.details.find((detail) => detail.level === level);
  return (order?.ids ?? []).flatMap((id) => {
    const territory = byId.get(id);
    const own = held.get(id);
    return territory === undefined || own === undefined
      ? []
      : [{ territory, files: own }];
  });
};

/** One choice of detail: its level and how many real territories it shows. */
export type DetailChoice = {
  readonly level: number;
  readonly territories: number;
  readonly recommended: boolean;
};

/** The details the report offers, coarsest first. */
export const detailChoices = (territories: Territories): DetailChoice[] => {
  const byId = new Map(territories.nodes.map((node) => [node.id, node]));
  return territories.details.map(({ level, ids }) => ({
    level,
    territories: ids.filter((id) => {
      const node = byId.get(id);
      return node !== undefined && isRealTerritory(node);
    }).length,
    recommended: level === territories.recommended,
  }));
};

/** The name a group is drawn under: the territory's path, or what a bucket is. */
export const groupName = ({ territory }: Group): string =>
  territoryName(territory);
