// Owns the universe: which files count as code for an analysis.
import { Effect, Order } from "effect";
import type { FileSystem, Path } from "effect";

import type { GitError } from "../git/git-errors.js";
import type { Git } from "../git/git.js";
import type { Complexity } from "../metrics/complexity.js";
import { isContractFile } from "./contract-files.js";
import { matchesAny } from "./globs.js";
import { isSourceLanguage } from "./languages.js";
import { measureSourceFile } from "./source-file.js";
import { listTrackedFiles, withoutGeneratedFiles } from "./tracked-files.js";

export type InventoryOptions = {
  /** Absolute path of the work tree root. */
  readonly root: string;
  /** Repository-relative directory the universe is limited to; "." for all. */
  readonly scope: string;
  /** Globs that replace the language allow-list and the contract list when non-empty. */
  readonly include: ReadonlyArray<string>;
  /** Globs removed after `include`. */
  readonly exclude: ReadonlyArray<string>;
};

/** A code file that counts, with what reading it revealed. */
export type InventoryFile = {
  readonly path: string;
  readonly complexity: Complexity;
};

/** The universe: code files, which are scored, and contract files, which only take part in coupling. */
export type Inventory = {
  /** Sorted by path. */
  readonly files: ReadonlyArray<InventoryFile>;
  /** Repository-relative paths of the contract files (see `isContractFile`), sorted. */
  readonly contracts: ReadonlyArray<string>;
  /**
   * Tracked files named like code or a contract (and not removed by
   * `exclude`) that the universe leaves out as generated: below a generated
   * or vendored directory (`dist`, `vendor`, …), minified by name (`.min.`),
   * marked `linguist-generated` or `linguist-vendored`, or not readable as
   * unminified text (binary, minified, or too large).
   */
  readonly generated: number;
};

/** Files read at once; bounds open file handles. */
const READ_CONCURRENCY = 16;

const EXCLUDED_DIRECTORIES = new Set([
  "vendor",
  "node_modules",
  "dist",
  "build",
  "generated",
  "__generated__",
  "tsp-output",
]);
const MINIFIED_NAME = /\.min\.[^/]+$/u;

const inExcludedDirectory = (path: string): boolean =>
  path
    .split("/")
    .slice(0, -1)
    .some((directory) => EXCLUDED_DIRECTORIES.has(directory));

/** Whether a path is named like a code or contract file the options ask for: the allow-list and the contract list, or `include` instead of both, then `exclude`. */
const namedLikeCode = (
  options: InventoryOptions,
): ((path: string) => boolean) => {
  const included =
    options.include.length === 0
      ? (path: string) => isSourceLanguage(path) || isContractFile(path)
      : matchesAny(options.include);
  const excluded = matchesAny(options.exclude);
  return (path) => included(path) && !excluded(path);
};

/** Whether a path's name says it is generated, vendored, or minified; needs no file access, so it runs first. */
const namedAsGenerated = (path: string): boolean =>
  inExcludedDirectory(path) || MINIFIED_NAME.test(path);

/**
 * Builds the universe: tracked, not ignored, not `linguist-generated` or
 * `linguist-vendored`, named like code or like a contract file (a language
 * allow-list and the contract list, or `include` instead of both, then
 * `exclude`), and readable as unminified text. A file that names a contract
 * (`isContractFile`) is a contract whatever the allow-list says; contracts get
 * no complexity. Both lists come back sorted by path, with the count of the
 * files named like code that were left out as generated.
 *
 * Git must run in `options.root`.
 */
export const inventory = (
  options: InventoryOptions,
): Effect.Effect<
  Inventory,
  GitError,
  Git | FileSystem.FileSystem | Path.Path
> =>
  Effect.gen(function* () {
    const tracked = yield* listTrackedFiles(options.scope);
    const likeCode = namedLikeCode(options);
    const named = tracked.filter((path) => likeCode(path));
    const candidates = yield* withoutGeneratedFiles(
      named.filter((path) => !namedAsGenerated(path)),
    );
    const measured = yield* Effect.forEach(
      candidates,
      (path) =>
        Effect.map(measureSourceFile(options.root, path), (complexity) =>
          complexity === undefined ? undefined : { path, complexity },
        ),
      { concurrency: READ_CONCURRENCY },
    );
    const readable = measured
      .filter((file) => file !== undefined)
      .toSorted((a, b) => Order.String(a.path, b.path));
    return {
      files: readable.filter(({ path }) => !isContractFile(path)),
      contracts: readable
        .filter(({ path }) => isContractFile(path))
        .map(({ path }) => path),
      generated: named.length - readable.length,
    };
  });
