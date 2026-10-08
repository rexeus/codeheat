// Owns which entry points a file belongs to.
import type { FileStats } from "../model/analysis.js";
import type { EntryPoint } from "../model/entry-point.js";
import type { Territory } from "../model/territory.js";
import { chainsOf } from "./ancestry.js";

/** The territories an entry concerns: its own, and those of its findings (a clique that a boundary between two territories took in has a member the entry's `territories` do not name). */
const concernedBy = ({ territories, findings }: EntryPoint): string[] => [
  ...territories,
  ...findings.flatMap((finding) => finding.territories),
];

/**
 * For each file of `files`, the `entryPoints` it belongs to, best first. An
 * entry that names files (`hotspot`, `copies`, `hub`) concerns exactly those
 * files; one that names none (`boundary`, `clique`) concerns every file that
 * lies in one of its territories or of the territories of its findings, below
 * them included. `nodes` is the territory tree.
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
          : concernedBy(entry).some((id) => chainOf(territory).has(id)),
      ),
    ]),
  );
};
