// Owns the territorial part of an analysis: the territories of the latest
// window and how well each one holds up to the way the code changes.
import { Effect } from "effect";
import type { FileSystem, Path } from "effect";

import type { GitError } from "../git/git-errors.js";
import type { Git } from "../git/git.js";
import type { Coupling, FileStats } from "../report/report.js";
import { measureTerritoryFit } from "../territory-fit/measure-territory-fit.js";
import { measureTerritories } from "./measure-territories.js";
import type { MeasuredTerritories } from "./measure-territories.js";
import type { WindowHistories } from "./windows.js";

/**
 * Builds and describes the territories of `files` (see `measureTerritories`)
 * and measures each one's design fit over the latest window, the series, and
 * the reported `couplings`. `minChanges` is `Thresholds.minModuleCommits`.
 */
export const measureTerritorial = (options: {
  readonly root: string;
  readonly scope: string;
  readonly packages: ReadonlySet<string>;
  readonly files: ReadonlyArray<FileStats>;
  readonly couplings: ReadonlyArray<Coupling>;
  readonly histories: WindowHistories;
  readonly minChanges: number;
}): Effect.Effect<
  MeasuredTerritories,
  GitError,
  Git | FileSystem.FileSystem | Path.Path
> =>
  Effect.gen(function* () {
    const { histories, couplings, minChanges } = options;
    const built = yield* measureTerritories({
      ...options,
      history: histories.current,
    });
    const { territories } = measureTerritoryFit(built.territories, {
      files: built.files,
      couplings,
      history: histories.current,
      series: histories.series,
      minChanges,
    });
    return { territories, files: built.files };
  });
