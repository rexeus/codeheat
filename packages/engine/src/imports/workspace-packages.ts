// Owns what the repository's manifests say about importable modules: which
// workspace packages exist, and which external packages are declared.
import { Effect, Path } from "effect";
import type { FileSystem } from "effect";

import { packageMainEntries } from "../modules/entry-points.js";
import { packageOf } from "../modules/package-directories.js";
import { readManifestFacts } from "../modules/package-manifest.js";
import { directoryOf } from "./relative-path.js";
import type { WorkspacePackage } from "./resolve.js";

/** The importable modules the manifests name. */
export type Workspace = {
  /** Packages by name. */
  readonly packages: ReadonlyMap<string, WorkspacePackage>;
  /** Package names that more than one manifest claims; an import of one cannot be told from the other. */
  readonly ambiguous: ReadonlySet<string>;
  /** Every dependency name declared by any of the manifests. */
  readonly dependencies: ReadonlySet<string>;
};

/**
 * Reads `manifestFiles`, repository-relative paths of `package.json` files.
 * The packages are those among them whose directory is in `packages`, owns a `universe` file, and
 * which have a `name`, each with the files that importing it by name reaches
 * (see `packageMainEntries`) among the `universe` files it owns, those whose
 * nearest package it is. The report's modules play no part, so a package that
 * is split into directory modules (or is the whole analysis) is still
 * importable by name. `--entry` and the report's entry points play no part
 * either: they describe interfaces, not what an import resolves to. `root` is
 * the repository root the paths are relative to.
 */
export const readWorkspace = (
  root: string,
  universe: Iterable<string>,
  packages: ReadonlySet<string>,
  manifestFiles: ReadonlyArray<string>,
): Effect.Effect<Workspace, never, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function* () {
    const path = yield* Path.Path;
    const owned = new Map<string, Array<string>>();
    for (const file of universe) {
      const home = packageOf(file, packages);
      if (home !== undefined) {
        owned.set(home, [...(owned.get(home) ?? []), file]);
      }
    }
    const byName = new Map<string, WorkspacePackage>();
    const ambiguous = new Set<string>();
    const dependencies = new Set<string>();
    for (const manifestFile of manifestFiles) {
      const facts = yield* readManifestFacts(path.join(root, manifestFile));
      if (facts === undefined) {
        continue;
      }
      for (const dependency of facts.dependencies) {
        dependencies.add(dependency);
      }
      const directory = directoryOf(manifestFile);
      if (facts.name !== undefined && owned.has(directory)) {
        if (byName.has(facts.name)) {
          ambiguous.add(facts.name);
        }
        byName.set(facts.name, {
          directory,
          entryPoints: packageMainEntries(
            directory,
            facts.rootTargets,
            owned.get(directory) ?? [],
          ),
        });
      }
    }
    return { packages: byName, ambiguous, dependencies };
  });

/**
 * The `package.json` files that say what the code under `scope` may import:
 * every one among the `tracked` files and the ones in the directories above
 * `scope`, which are not tracked paths of the scope. Repository-relative.
 */
export const manifestFilesFor = (
  scope: string,
  tracked: Iterable<string>,
): ReadonlyArray<string> => {
  const parts = scope === "." ? [] : scope.split("/");
  const above = [
    "package.json",
    ...parts.map(
      (_, index) => `${parts.slice(0, index + 1).join("/")}/package.json`,
    ),
  ];
  const inScope = [...tracked].filter(
    (file) => file === "package.json" || file.endsWith("/package.json"),
  );
  return [...new Set([...above, ...inScope])];
};
