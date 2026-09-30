// Owns the universe: which files count as code for an analysis.
import { Effect, Order } from "effect";
import type { FileSystem, Path } from "effect";

import type { GitError } from "../git/git-errors.js";
import type { Git } from "../git/git.js";
import type { Complexity } from "../metrics/complexity.js";
import { matchesAny } from "./globs.js";
import { isSourceLanguage } from "./languages.js";
import { measureSourceFile } from "./source-file.js";
import { listTrackedFiles, withoutGeneratedFiles } from "./tracked-files.js";

export type InventoryOptions = {
  /** Absolute path of the work tree root. */
  readonly root: string;
  /** Repository-relative directory the universe is limited to; "." for all. */
  readonly scope: string;
  /** Globs that replace the language allow-list when non-empty. */
  readonly include: ReadonlyArray<string>;
  /** Globs removed after `include`. */
  readonly exclude: ReadonlyArray<string>;
};

/** A file that counts, with what reading it revealed. */
export type InventoryFile = {
  readonly path: string;
  readonly complexity: Complexity;
};

/** Files read at once; bounds open file handles. */
const READ_CONCURRENCY = 16;

const EXCLUDED_DIRECTORIES = new Set([
  "vendor",
  "node_modules",
  "dist",
  "build",
]);
const MINIFIED_NAME = /\.min\.[^/]+$/u;

const inExcludedDirectory = (path: string): boolean =>
  path
    .split("/")
    .slice(0, -1)
    .some((directory) => EXCLUDED_DIRECTORIES.has(directory));

/** Name-based rules; they need no file access, so they run first. */
const namedAsCode = (
  options: InventoryOptions,
): ((path: string) => boolean) => {
  const included =
    options.include.length === 0
      ? isSourceLanguage
      : matchesAny(options.include);
  const excluded = matchesAny(options.exclude);
  return (path) =>
    !inExcludedDirectory(path) &&
    !MINIFIED_NAME.test(path) &&
    included(path) &&
    !excluded(path);
};

/**
 * Builds the universe: tracked, not ignored, not `linguist-generated` or
 * `linguist-vendored`, named like code (a language allow-list, or `include`
 * instead of it, then `exclude`), and readable as unminified text.
 * Files come back sorted by path.
 *
 * Git must run in `options.root`.
 */
export const inventory = (
  options: InventoryOptions,
): Effect.Effect<
  ReadonlyArray<InventoryFile>,
  GitError,
  Git | FileSystem.FileSystem | Path.Path
> =>
  Effect.gen(function* () {
    const tracked = yield* listTrackedFiles(options.scope);
    const isCode = namedAsCode(options);
    const candidates = yield* withoutGeneratedFiles(
      tracked.filter((path) => isCode(path)),
    );
    const measured = yield* Effect.forEach(
      candidates,
      (path) =>
        Effect.map(measureSourceFile(options.root, path), (complexity) =>
          complexity === undefined ? undefined : { path, complexity },
        ),
      { concurrency: READ_CONCURRENCY },
    );
    return measured
      .filter((file) => file !== undefined)
      .toSorted((a, b) => Order.String(a.path, b.path));
  });
