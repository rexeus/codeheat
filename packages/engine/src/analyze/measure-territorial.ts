// Owns the territorial part of an analysis: the territories of the latest
// window, how well each one holds up to the way the code changes, and where to
// start because of it.
import { Effect } from "effect";
import type { FileSystem, Path } from "effect";

import { rankEntryPoints } from "../entry-points/rank-entry-points.js";
import type { GitError } from "../git/git-errors.js";
import type { Git } from "../git/git.js";
import type { CopyFamily } from "../report/copy-family.js";
import type { EntryPoint } from "../report/entry-point.js";
import type { Coupling, FileStats } from "../report/report.js";
import type { UnstableInterface } from "../report/unstable-interface.js";
import { measureTerritoryFit } from "../territory-fit/measure-territory-fit.js";
import { measureTerritories } from "./measure-territories.js";
import type { MeasuredTerritories } from "./measure-territories.js";
import type { WindowHistories } from "./windows.js";

/** The territories, the files with their territory, and the places to start. */
export type MeasuredTerritorial = MeasuredTerritories & {
  readonly entryPoints: ReadonlyArray<EntryPoint>;
};

/**
 * Builds and describes the territories of `files` (see `measureTerritories`)
 * and measures each one's design fit over the latest window, the series, and
 * the reported `couplings`, then ranks the entry points among them, the copy
 * families, and the unstable interfaces. `minChanges` is
 * `Thresholds.minModuleCommits`; `changes` the counted changes of the window.
 */
export const measureTerritorial = (options: {
  readonly root: string;
  readonly scope: string;
  readonly packages: ReadonlySet<string>;
  readonly files: ReadonlyArray<FileStats>;
  readonly couplings: ReadonlyArray<Coupling>;
  readonly copyFamilies: ReadonlyArray<CopyFamily>;
  readonly unstableInterfaces: ReadonlyArray<UnstableInterface>;
  readonly changes: number;
  readonly histories: WindowHistories;
  readonly minChanges: number;
}): Effect.Effect<
  MeasuredTerritorial,
  GitError,
  Git | FileSystem.FileSystem | Path.Path
> =>
  Effect.gen(function* () {
    const { histories, couplings, minChanges } = options;
    const built = yield* measureTerritories({
      ...options,
      history: histories.current,
    });
    const fitted = measureTerritoryFit(built.territories, {
      files: built.files,
      couplings,
      history: histories.current,
      series: histories.series,
      minChanges,
    });
    return {
      territories: fitted.territories,
      files: built.files,
      entryPoints: rankEntryPoints({
        territories: fitted.territories,
        files: built.files,
        cliques: fitted.cliques,
        copyFamilies: options.copyFamilies,
        couplings,
        unstableInterfaces: options.unstableInterfaces,
        changes: options.changes,
        minChanges,
      }),
    };
  });
