// Owns the universe: which files count as code for an analysis.
import { Effect, Order } from "effect";
import type { FileSystem, Path } from "effect";

import type { GitError } from "../git/git-errors.js";
import type { Git } from "../git/git.js";
import type { Complexity } from "../metrics/complexity.js";
import { isContractFile } from "./contract-files.js";
import { applyExcludes } from "./excludes.js";
import type { ExcludeCount, ExcludePattern } from "./excludes.js";
import { matchesAny } from "./globs.js";
import { isSourceLanguage } from "./languages.js";
import { readSourceFile } from "./source-file.js";
import { listTrackedFiles, withoutGeneratedFiles } from "./tracked-files.js";

export type InventoryOptions = {
  /** Absolute path of the work tree root. */
  readonly root: string;
  /** Repository-relative directory the universe is limited to; "." for all. */
  readonly scope: string;
  /** Globs that replace the language allow-list and the contract list when non-empty. */
  readonly include: ReadonlyArray<string>;
  /** The patterns that leave files out after `include` (see `activeExcludes`). */
  readonly exclude: ReadonlyArray<ExcludePattern>;
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
   * Every pattern of `exclude`, in order, with the tracked files named like
   * code or a contract that it left out (see `applyExcludes`).
   */
  readonly excluded: ReadonlyArray<ExcludeCount>;
  /**
   * Tracked files named like code or a contract, and left by `exclude`, that
   * the universe leaves out as generated: marked `linguist-generated` or
   * `linguist-vendored`, or whose content is binary, minified, or too large
   * (see `readSourceFile`). A file that is missing from the work tree or
   * holds only whitespace is left out without counting here.
   */
  readonly generated: number;
};

/** Files read at once; bounds open file handles. */
const READ_CONCURRENCY = 16;

/** Whether a path is named like a code or contract file the options ask for: the allow-list and the contract list, or `include` instead of both. */
const namedLikeCode = (
  include: ReadonlyArray<string>,
): ((path: string) => boolean) =>
  include.length === 0
    ? (path: string) => isSourceLanguage(path) || isContractFile(path)
    : matchesAny(include);

/**
 * Builds the universe: tracked, not ignored, named like code or like a
 * contract file (a language allow-list and the contract list, or `include`
 * instead of both), matched by no pattern of `exclude`, not
 * `linguist-generated` or `linguist-vendored`, and readable as unminified
 * text. A file that names a contract (`isContractFile`) is a contract whatever
 * the allow-list says; contracts get no complexity. Both lists come back
 * sorted by path, with the count of the files named like code that each
 * pattern left out and of those left out as generated.
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
    const likeCode = namedLikeCode(options.include);
    const { kept, excluded } = applyExcludes(
      tracked.filter((path) => likeCode(path)),
      options.exclude,
    );
    const candidates = yield* withoutGeneratedFiles(kept);
    const readings = yield* Effect.forEach(
      candidates,
      (path) =>
        Effect.map(readSourceFile(options.root, path), (reading) => ({
          path,
          reading,
        })),
      { concurrency: READ_CONCURRENCY },
    );
    const readable = readings
      .flatMap(({ path, reading }) =>
        reading.kind === "text"
          ? [{ path, complexity: reading.complexity }]
          : [],
      )
      .toSorted((a, b) => Order.String(a.path, b.path));
    const generatedContent = readings.filter(
      ({ reading }) => reading.kind === "generated",
    ).length;
    return {
      files: readable.filter(({ path }) => !isContractFile(path)),
      contracts: readable
        .filter(({ path }) => isContractFile(path))
        .map(({ path }) => path),
      excluded,
      generated: kept.length - candidates.length + generatedContent,
    };
  });
