// Owns reading the universe of an analysis from the work tree: which files
// count, the modules they form, and what the code says about those modules.
import { Effect } from "effect";
import type { FileSystem, Path } from "effect";

import type { LanguageAdapter } from "../code/language-adapter.js";
import { contractHomes } from "../contracts/homes.js";
import type { GitError } from "../git/git-errors.js";
import type { Git } from "../git/git.js";
import { measureDepths } from "../modules/depth.js";
import { detectModules } from "../modules/detect.js";
import { findEntryPoints } from "../modules/entry-points.js";
import { listPackageDirectories } from "../modules/package-directories.js";
import { activeExcludes } from "../universe/excludes.js";
import type { ExcludeCount } from "../universe/excludes.js";
import { inventory } from "../universe/inventory.js";
import type { Universe } from "./measure.js";

/**
 * The universe, the depth of the modules that have one (see
 * `measureDepths`), and how many files it leaves out by each exclude pattern
 * and as generated (see `Inventory`).
 */
export type UniverseReading = Universe & {
  readonly depths: Effect.Success<ReturnType<typeof measureDepths>>;
  readonly excluded: ReadonlyArray<ExcludeCount>;
  readonly generated: number;
};

/**
 * Reads the universe under `root` limited to `scope`: the files `include`
 * names and the exclude patterns leave (the default ones unless
 * `defaultExcludes` is false, then `exclude`; see `activeExcludes`), the
 * modules and entry points of its code files (`entry` replaces detection),
 * where its contract files live, and the module depths `adapters` can
 * measure.
 */
export const readUniverse = (options: {
  readonly root: string;
  readonly scope: string;
  readonly include: ReadonlyArray<string>;
  readonly exclude: ReadonlyArray<string>;
  readonly defaultExcludes: boolean;
  readonly entry: ReadonlyArray<string>;
  readonly adapters: ReadonlyArray<LanguageAdapter>;
}): Effect.Effect<
  UniverseReading,
  GitError,
  Git | FileSystem.FileSystem | Path.Path
> =>
  Effect.gen(function* () {
    const { root, scope } = options;
    const inventoried = yield* inventory({
      root,
      scope,
      include: options.include,
      exclude: activeExcludes(options.exclude, options.defaultExcludes),
    });
    const { files, contracts, excluded, generated } = inventoried;
    const packageDirectories = yield* listPackageDirectories(scope);
    const modules = detectModules(
      files.map((file) => file.path),
      packageDirectories,
    );
    const entryPoints = yield* findEntryPoints(
      root,
      modules,
      packageDirectories,
      options.entry,
    );
    const depths = yield* measureDepths({
      root,
      adapters: options.adapters,
      files,
      modules,
      entryPoints,
    });
    return {
      files,
      modules,
      contracts: contractHomes(contracts, modules),
      entryPoints,
      packages: packageDirectories,
      depths,
      excluded,
      generated,
    };
  });

/** Every path of the universe: code and contract files. */
export const pathsOf = ({
  files,
  contracts,
}: Pick<Universe, "files" | "contracts">): ReadonlySet<string> =>
  new Set([...files.map(({ path }) => path), ...contracts.keys()]);
