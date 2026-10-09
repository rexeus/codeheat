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
import { isTestPath } from "../modules/test-path.js";
import { inventory } from "../universe/inventory.js";
import type { Universe } from "./measure.js";

/**
 * The universe, the depth of the modules that have one (see
 * `measureDepths`), and how many files it leaves out as generated (see
 * `Inventory.generated`).
 */
export type UniverseReading = Universe & {
  readonly depths: Effect.Success<ReturnType<typeof measureDepths>>;
  readonly generated: number;
};

/**
 * Reads the universe under `root` limited to `scope`: the files `include` and
 * `exclude` leave, with the test code among them set apart (see
 * `isTestPath`), the modules and entry points of its other code files
 * (`entry` replaces detection), where its contract files live, and the module
 * depths `adapters` can measure.
 */
export const readUniverse = (options: {
  readonly root: string;
  readonly scope: string;
  readonly include: ReadonlyArray<string>;
  readonly exclude: ReadonlyArray<string>;
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
      exclude: options.exclude,
    });
    const { contracts, generated } = inventoried;
    const files = inventoried.files.filter(({ path }) => !isTestPath(path));
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
      testCode: inventoried.files
        .filter(({ path }) => isTestPath(path))
        .map(({ path }) => path),
      modules,
      contracts: contractHomes(contracts, modules),
      entryPoints,
      packages: packageDirectories,
      depths,
      generated,
    };
  });

/** Every path of the universe: code, test code, and contract files. */
export const pathsOf = ({
  files,
  testCode,
  contracts,
}: Pick<Universe, "files" | "testCode" | "contracts">): ReadonlySet<string> =>
  new Set([...files.map(({ path }) => path), ...testCode, ...contracts.keys()]);
