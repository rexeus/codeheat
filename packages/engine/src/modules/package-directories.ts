// Owns which directories are packages: those with a tracked manifest of a common build tool.
import { Effect } from "effect";

import type { GitError } from "../git/git-errors.js";
import type { Git } from "../git/git.js";
import { listTrackedFiles } from "../universe/tracked-files.js";

const MANIFEST_NAMES = new Set([
  "package.json",
  "go.mod",
  "Cargo.toml",
  "pyproject.toml",
  "pom.xml",
  "build.gradle",
  "build.gradle.kts",
]);

const isManifest = (name: string): boolean =>
  MANIFEST_NAMES.has(name) || name.endsWith(".csproj");

/** The directories, other than the repository root, that hold one of the `tracked` manifests. */
export const packageDirectoriesOf = (
  tracked: Iterable<string>,
): ReadonlySet<string> => {
  const directories = new Set<string>();
  for (const path of tracked) {
    const separator = path.lastIndexOf("/");
    if (separator > 0 && isManifest(path.slice(separator + 1))) {
      directories.add(path.slice(0, separator));
    }
  }
  return directories;
};

/**
 * The directories, other than the repository root, that contain a manifest.
 * Manifests are not code, so they are read from the tracked files rather
 * than the universe. Git must run in the repository root.
 */
export const listPackageDirectories = (
  scope: string,
): Effect.Effect<ReadonlySet<string>, GitError, Git> =>
  Effect.map(listTrackedFiles(scope), packageDirectoriesOf);

/** The package a file belongs to: its nearest enclosing directory in `packages`; undefined outside every package. */
export const packageOf = (
  file: string,
  packages: ReadonlySet<string>,
): string | undefined => {
  const parts = file.split("/").slice(0, -1);
  return parts
    .map((_, index) => parts.slice(0, parts.length - index).join("/"))
    .find((directory) => packages.has(directory));
};
