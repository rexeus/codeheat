// Owns which workspace packages other files can import by name.
import { Effect, Path } from "effect";
import type { FileSystem } from "effect";

import { readManifestName } from "../modules/package-manifest.js";
import type { WorkspacePackage } from "./resolve.js";

/**
 * The packages among `directories` whose `package.json` has a `name`, keyed by
 * that name, with the entry points `entryPoints` knows for their directory.
 * `root` is the repository root the directories are relative to.
 */
export const readWorkspacePackages = (
  root: string,
  directories: ReadonlySet<string>,
  entryPoints: ReadonlyMap<string, ReadonlyArray<string>>,
): Effect.Effect<
  ReadonlyMap<string, WorkspacePackage>,
  never,
  FileSystem.FileSystem | Path.Path
> =>
  Effect.gen(function* () {
    const path = yield* Path.Path;
    const packages = new Map<string, WorkspacePackage>();
    for (const directory of directories) {
      const name = yield* readManifestName(
        path.join(root, directory, "package.json"),
      );
      if (name !== undefined) {
        packages.set(name, {
          directory,
          entryPoints: entryPoints.get(directory) ?? [],
        });
      }
    }
    return packages;
  });
