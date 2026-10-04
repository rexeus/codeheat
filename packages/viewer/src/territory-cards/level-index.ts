// Owns how the report's territories read at one detail: which territories
// are shown, which of them holds any node of the tree, and which files each holds.
import type { FileStats, Report } from "@codeheat/engine";

import type { Territory } from "../territories/territory-index.js";

/** One detail (`TerritoryDetail`) of the report, indexed. */
export type LevelIndex = {
  readonly level: number;
  /** The territories shown at this detail, in the report's order: the hottest real territory first, test code and buckets last. */
  readonly territories: readonly Territory[];
  /** The territory shown at this detail that is, or contains, the node `id`; `undefined` for an unknown id. */
  readonly ownerOf: (id: string) => string | undefined;
  /** The files of a shown territory (test code that belongs to it included), hottest first. */
  readonly filesOf: (id: string) => readonly FileStats[];
};

/** Maps every node at or below each shown territory to that territory. */
const ownersOf = (
  shown: readonly Territory[],
  byId: ReadonlyMap<string, Territory>,
): Map<string, string> => {
  const owners = new Map<string, string>();
  for (const { id } of shown) {
    const pending = [id];
    for (let next = pending.pop(); next !== undefined; next = pending.pop()) {
      owners.set(next, id);
      pending.push(...(byId.get(next)?.children ?? []));
    }
  }
  return owners;
};

/**
 * The files worth naming first: the code of `files`, which are hottest first, or
 * all of them when they are all test code. Test code is change effort but not design.
 */
export const codeFirst = (
  files: readonly FileStats[],
): readonly FileStats[] => {
  const code = files.filter(({ test }) => !test);
  return code.length === 0 ? files : code;
};

/**
 * Indexes the territories at `level`; empty when the report has no such
 * detail. `files` must be hottest first (the report's order).
 */
export const indexLevel = (
  { details, nodes }: Report["territories"],
  files: readonly FileStats[],
  level: number,
): LevelIndex => {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const ids = details.find((detail) => detail.level === level)?.ids ?? [];
  const territories = ids.flatMap((id) => byId.get(id) ?? []);
  const owners = ownersOf(territories, byId);
  const held = new Map<string, FileStats[]>();
  for (const file of files) {
    const owner = owners.get(file.territory);
    if (owner !== undefined) {
      const own = held.get(owner) ?? [];
      own.push(file);
      held.set(owner, own);
    }
  }
  return {
    level,
    territories,
    ownerOf: (id) => owners.get(id),
    filesOf: (id) => held.get(id) ?? [],
  };
};
