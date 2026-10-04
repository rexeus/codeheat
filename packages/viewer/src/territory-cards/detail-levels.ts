// Owns the choices of the detail slider: the report's levels, how many
// territories each shows, and which one the report recommends.
import type { Report } from "@codeheat/engine";

import { isRealTerritory } from "../territories/territory-index.js";

export type LevelChoice = {
  readonly level: number;
  /** Real territories at this detail; test code and buckets of leftovers are not counted. */
  readonly territories: number;
  readonly recommended: boolean;
};

/** The levels of the report, coarsest first; empty when it has no territories. */
export const levelChoicesOf = ({
  recommended,
  details,
  nodes,
}: Report["territories"]): LevelChoice[] => {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  return details
    .toSorted((left, right) => left.level - right.level)
    .map(({ level, ids }) => ({
      level,
      territories: ids.filter((id) => {
        const node = byId.get(id);
        return node !== undefined && isRealTerritory(node);
      }).length,
      recommended: level === recommended,
    }));
};
