import { countedChanges } from "../coupling/coupling.js";
// Owns the territories of an analysis: the latest window's counted changes
// and the packages of the universe, turned into a tree of areas.
import type { History } from "../history/history.js";
import type { FileStats } from "../report/report.js";
import type { Territories } from "../report/territory.js";
import { buildTerritories } from "../territories/build-territories.js";

/** The territories, and the files with the finest territory each belongs to. */
export type MeasuredTerritories = {
  readonly territories: Territories;
  readonly files: ReadonlyArray<FileStats>;
};

/**
 * Builds the territories of `files` from the counted changes of `history`
 * (`minChanges` is `Thresholds.minModuleCommits`). Each file comes back with
 * its `territory`.
 */
export const measureTerritories = (options: {
  readonly packages: ReadonlySet<string>;
  readonly files: ReadonlyArray<FileStats>;
  readonly history: History;
  readonly minChanges: number;
}): MeasuredTerritories => {
  const { history, files } = options;
  const tree = buildTerritories({
    files,
    packages: options.packages,
    minChanges: options.minChanges,
    changes: countedChanges(history.changes).map((change) =>
      Array.from(change.files, (id) => history.paths[id] ?? ""),
    ),
  });
  return {
    territories: {
      recommended: tree.recommended,
      details: tree.details,
      nodes: tree.nodes.map(
        ({ members: _members, lead: _lead, ...node }) => node,
      ),
    },
    files: files.map((file) =>
      Object.assign({}, file, {
        territory: tree.territoryOf.get(file.path) ?? "",
      }),
    ),
  };
};
