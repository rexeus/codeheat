// Owns which entry points a file belongs to.
import type { EntryPoint } from "../report/entry-point.js";
import type { FileStats } from "../report/report.js";
import type { Territory } from "../report/territory.js";
import { chainsOf } from "./ancestry.js";

/**
 * For each file of `files`, the `entryPoints` it belongs to, best first. An
 * entry that names files (`hotspot`, `copies`, `hub`) concerns exactly those
 * files; one that names none (`boundary`, `clique`) concerns every file that
 * lies in one of its territories, below them included. `nodes` is the
 * territory tree.
 */
export const entryPointsOfFiles = (
  files: ReadonlyArray<Pick<FileStats, "path" | "territory">>,
  entryPoints: ReadonlyArray<EntryPoint>,
  nodes: ReadonlyArray<Pick<Territory, "id" | "parent">>,
): ReadonlyMap<string, ReadonlyArray<EntryPoint>> => {
  const chainOf = chainsOf(nodes);
  return new Map(
    files.map(({ path, territory }) => [
      path,
      entryPoints.filter((entry) =>
        entry.files.length > 0
          ? entry.files.includes(path)
          : entry.territories.some((id) => chainOf(territory).has(id)),
      ),
    ]),
  );
};
