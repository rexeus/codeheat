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

/** A manifest's claim on a package name. */
type Claim = {
  readonly name: string;
  readonly directory: string;
  readonly rootTargets: ReadonlyArray<string>;
  /** The universe files its entry points are looked for among. */
  readonly files: ReadonlyArray<string>;
  /** Whether `files` are the ones the package owns, not those below it. */
  readonly ownsFiles: boolean;
};

/** The packages by name, and the names that more than one claim keeps open; see `readWorkspace` for which claims count. */
const registered = (
  claims: ReadonlyArray<Claim>,
): Pick<Workspace, "packages" | "ambiguous"> => {
  const ownerNames = new Set(
    claims.filter(({ ownsFiles }) => ownsFiles).map(({ name }) => name),
  );
  const packages = new Map<string, WorkspacePackage>();
  const ambiguous = new Set<string>();
  for (const claim of claims) {
    if (!claim.ownsFiles && ownerNames.has(claim.name)) {
      continue;
    }
    if (packages.has(claim.name)) {
      ambiguous.add(claim.name);
    }
    packages.set(claim.name, {
      directory: claim.directory,
      entryPoints: packageMainEntries(
        claim.directory,
        claim.rootTargets,
        claim.files,
      ),
    });
  }
  return { packages, ambiguous };
};

/**
 * Reads `manifestFiles`, repository-relative paths of `package.json` files.
 * The packages are those among them that have a `name` and `universe` files
 * below their directory. Importing a package by name reaches the files its
 * manifest names (see `packageMainEntries`) among the `universe` files it
 * owns, those whose nearest package it is. A package that owns none (a
 * workspace folder above its sub-packages) resolves its targets among every
 * `universe` file below its directory instead, so its `main` may point into
 * a sub-package; it is registered only when no package that owns files claims
 * its name, because a name it shares with a real package belongs to that one.
 * The repository root package is never registered. The report's modules play
 * no part, so a package that is split into directory modules (or is the whole
 * analysis) is still importable by name. `--entry` and the report's entry
 * points play no part either: they describe interfaces, not what an import
 * resolves to. `root` is the repository root the paths are relative to.
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
    const universeFiles = [...universe];
    const claims: Array<Claim> = [];
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
      const ownFiles = owned.get(directory);
      const files =
        ownFiles ??
        universeFiles.filter((file) => file.startsWith(`${directory}/`));
      if (facts.name !== undefined && files.length > 0) {
        claims.push({
          name: facts.name,
          directory,
          rootTargets: facts.rootTargets,
          files,
          ownsFiles: ownFiles !== undefined,
        });
      }
    }
    return { ...registered(claims), dependencies };
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
