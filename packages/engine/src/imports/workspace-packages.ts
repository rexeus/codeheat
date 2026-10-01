// Owns which workspace packages other files can import by name.
import { Effect, Path } from "effect";
import type { FileSystem } from "effect";

import type { ModuleRef } from "../modules/detect.js";
import { groupByModule, packageMainEntries } from "../modules/entry-points.js";
import { readManifestFacts } from "../modules/package-manifest.js";
import type { WorkspacePackage } from "./resolve.js";

/**
 * The packages among the `modules` whose `package.json` has a `name`, keyed by
 * that name, each with the files that importing it by name reaches (see
 * `packageMainEntries`). `root` is the repository root the modules are
 * relative to. The entry points of the report, and `--entry`, play no part:
 * they describe interfaces, not what an import resolves to.
 */
export const readWorkspacePackages = (
  root: string,
  modules: ReadonlyMap<string, ModuleRef>,
): Effect.Effect<
  ReadonlyMap<string, WorkspacePackage>,
  never,
  FileSystem.FileSystem | Path.Path
> =>
  Effect.gen(function* () {
    const path = yield* Path.Path;
    const packages = new Map<string, WorkspacePackage>();
    for (const [directory, { kind, files }] of groupByModule(modules)) {
      if (kind !== "package") {
        continue;
      }
      const facts = yield* readManifestFacts(
        path.join(root, directory, "package.json"),
      );
      if (facts?.name !== undefined) {
        packages.set(facts.name, {
          directory,
          entryPoints: packageMainEntries(directory, facts.rootTargets, files),
        });
      }
    }
    return packages;
  });
