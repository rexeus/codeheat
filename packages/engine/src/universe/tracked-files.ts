// Owns what git says about files: which are tracked and not ignored, and
// which are marked generated or vendored.
import { Effect } from "effect";

import type { GitError } from "../git/git-errors.js";
import { Git } from "../git/git.js";

const splitNul = (output: string): ReadonlyArray<string> =>
  output.split("\0").filter((field) => field !== "");

const pathspec = (scope: string): ReadonlyArray<string> =>
  scope === "." ? [] : ["--", `:(literal)${scope}`];

/** `ls-files -s` entries look like `<mode> <sha> <stage>\t<path>`. */
const parseStagedEntry = (
  entry: string,
): { readonly mode: string; readonly path: string } => ({
  mode: entry.slice(0, entry.indexOf(" ")),
  path: entry.slice(entry.indexOf("\t") + 1),
});

/**
 * Git stores symlinks (120000) and submodules (160000) as entries that are
 * not file contents; reading through them would leave the repository.
 */
const isBlob = ({ mode }: { readonly mode: string }): boolean =>
  mode.startsWith("100");

/**
 * Repository-relative paths of the regular files git tracks under `scope`
 * ("." for all), without symlinks, submodules, and files that ignore rules
 * match. Tracked-but-ignored files are left out because `.gitignore` states
 * they are not part of the project.
 */
export const listTrackedFiles = (
  scope: string,
): Effect.Effect<ReadonlyArray<string>, GitError, Git> =>
  Effect.gen(function* () {
    const git = yield* Git;
    const tracked = yield* git.text([
      "ls-files",
      "-z",
      "--stage",
      ...pathspec(scope),
    ]);
    const ignored = yield* git.text([
      "ls-files",
      "-z",
      "--cached",
      "--ignored",
      "--exclude-standard",
      ...pathspec(scope),
    ]);
    const ignoredPaths = new Set(splitNul(ignored));
    const paths = splitNul(tracked)
      .map((entry) => parseStagedEntry(entry))
      .filter((entry) => isBlob(entry))
      .map(({ path }) => path);
    return [...new Set(paths)].filter((path) => !ignoredPaths.has(path));
  });

/** Attribute values git reports for an attribute that is switched on. */
const ENABLED_VALUES = new Set(["set", "true"]);

/**
 * The paths not marked `linguist-generated` or `linguist-vendored` in
 * `.gitattributes`. Order is kept.
 */
export const withoutGeneratedFiles = (
  paths: ReadonlyArray<string>,
): Effect.Effect<ReadonlyArray<string>, GitError, Git> =>
  Effect.gen(function* () {
    if (paths.length === 0) {
      return paths;
    }
    const git = yield* Git;
    const output = yield* git.text(
      [
        "check-attr",
        "-z",
        "--stdin",
        "linguist-generated",
        "linguist-vendored",
      ],
      paths.map((path) => `${path}\0`).join(""),
    );
    // Output is `<path> NUL <attribute> NUL <value> NUL` per queried attribute.
    const fields = splitNul(output);
    const excluded = new Set<string>();
    for (let index = 0; index + 2 < fields.length; index += 3) {
      if (ENABLED_VALUES.has(fields[index + 2] ?? "")) {
        excluded.add(fields[index] ?? "");
      }
    }
    return paths.filter((path) => !excluded.has(path));
  });
