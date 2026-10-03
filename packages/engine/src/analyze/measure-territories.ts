// Owns the territories of an analysis: the latest window's counted changes
// and the packages of the universe, turned into a tree of described areas.
import { Effect } from "effect";
import type { FileSystem, Path } from "effect";

import { countedChanges } from "../coupling/coupling.js";
import type { GitError } from "../git/git-errors.js";
import type { Git } from "../git/git.js";
import type { History } from "../history/history.js";
import type { FileStats } from "../report/report.js";
import type { Territories } from "../report/territory.js";
import { buildTerritories } from "../territories/build-territories.js";
import { describeTerritories } from "../territories/describe-territories.js";
import { listTrackedBlobs } from "../universe/tracked-files.js";

/** The territories, and the files with the finest territory each belongs to. */
export type MeasuredTerritories = {
  readonly territories: Territories;
  readonly files: ReadonlyArray<FileStats>;
};

/**
 * Builds the territories of `files` from the counted changes of `history`
 * (`minChanges` is `Thresholds.minModuleCommits`) and describes them from the
 * manifests and READMEs under `root`; git must run in `root`. Each file comes
 * back with its `territory`.
 */
export const measureTerritories = (options: {
  readonly root: string;
  readonly scope: string;
  readonly packages: ReadonlySet<string>;
  readonly files: ReadonlyArray<FileStats>;
  readonly history: History;
  readonly minChanges: number;
}): Effect.Effect<
  MeasuredTerritories,
  GitError,
  Git | FileSystem.FileSystem | Path.Path
> =>
  Effect.gen(function* () {
    const { history, files } = options;
    const tree = buildTerritories({
      files,
      packages: options.packages,
      minChanges: options.minChanges,
      changes: countedChanges(history.changes).map((change) =>
        Array.from(change.files, (id) => history.paths[id] ?? ""),
      ),
    });
    const tracked = yield* listTrackedBlobs(options.scope);
    const territories = yield* describeTerritories(
      options.root,
      tree,
      files,
      tracked,
    );
    return {
      territories,
      files: files.map((file) =>
        Object.assign({}, file, {
          territory: tree.territoryOf.get(file.path) ?? "",
        }),
      ),
    };
  });
