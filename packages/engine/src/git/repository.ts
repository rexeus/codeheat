// Owns locating the repository an analysis belongs to and the part of it in scope.
import { Effect, FileSystem, Path } from "effect";
import type { ChildProcessSpawner } from "effect/process";

import { GitCommandFailed, NotAGitRepository } from "./git-errors.js";
import type { GitError } from "./git-errors.js";
import { Git } from "./git.js";

/** Git's exit code for "not a git repository" and other fatal usage errors. */
const FATAL_EXIT_CODE = 128;
/** Exit code of `rev-parse --verify --quiet` for a ref that does not resolve. */
const UNRESOLVED_EXIT_CODE = 1;

const notARepository = (
  directory: string,
  failure: GitCommandFailed,
): GitError =>
  failure.exitCode === FATAL_EXIT_CODE
    ? new NotAGitRepository({ path: directory })
    : failure;

/**
 * The absolute root of the work tree containing `directory`.
 *
 * Fails with `NotAGitRepository` when `directory` is missing or outside a
 * work tree, and with `GitNotFound` when git is not installed.
 */
export const repositoryRoot = (
  directory: string,
): Effect.Effect<
  string,
  GitError,
  ChildProcessSpawner.ChildProcessSpawner | FileSystem.FileSystem
> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const git = yield* Git;
    const exists = yield* fs
      .exists(directory)
      .pipe(Effect.orElseSucceed(() => false));
    if (!exists) {
      return yield* new NotAGitRepository({ path: directory });
    }
    const output = yield* git
      .text(["rev-parse", "--show-toplevel"])
      .pipe(
        Effect.catchTag("GitCommandFailed", (failure) =>
          Effect.fail(notARepository(directory, failure)),
        ),
      );
    return output.trim();
  }).pipe(Effect.provide(Git.layer(directory)));

/**
 * The repository-relative POSIX path of `scope`, which is absolute or
 * relative to `cwd`; "." for the repository root itself.
 *
 * Fails with `NotAGitRepository` when `scope` lies outside the work tree at `root`.
 */
export const repositoryScope = (
  root: string,
  cwd: string,
  scope: string,
): Effect.Effect<
  string,
  NotAGitRepository,
  FileSystem.FileSystem | Path.Path
> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const absolute = path.resolve(cwd, scope);
    // git reports the real path of the root, so compare real paths.
    const resolved = yield* fs
      .realPath(absolute)
      .pipe(Effect.orElseSucceed(() => absolute));
    const relative = path.relative(root, resolved);
    const segments = relative.split(path.sep);
    if (segments[0] === ".." || path.isAbsolute(relative)) {
      return yield* new NotAGitRepository({ path: absolute });
    }
    return relative === "" ? "." : segments.join("/");
  });

/** The commit `HEAD` points to, or null for a repository without commits. */
export const readHead: Effect.Effect<string | null, GitError, Git> = Effect.gen(
  function* () {
    const git = yield* Git;
    const output = yield* git
      .text(["rev-parse", "--verify", "--quiet", "HEAD"])
      .pipe(
        Effect.catchTag(
          "GitCommandFailed",
          (failure): Effect.Effect<string, GitCommandFailed> =>
            failure.exitCode === UNRESOLVED_EXIT_CODE
              ? Effect.succeed("")
              : Effect.fail(failure),
        ),
      );
    return output.trim() === "" ? null : output.trim();
  },
);

/**
 * When the oldest reachable commit was made, in seconds since the epoch; null
 * without commits. Of several root commits the earliest counts. In a shallow
 * clone the commits it was cut at are roots, so this is the start of the
 * history that exists.
 *
 * Runs git inside the repository, which needs a `HEAD`.
 */
export const readOldestCommitTime: Effect.Effect<number | null, GitError, Git> =
  Effect.gen(function* () {
    const git = yield* Git;
    const output = yield* git.text(["log", "--max-parents=0", "--format=%ct"]);
    const times = output
      .split("\n")
      .filter((line) => line !== "")
      .map(Number);
    return times.length === 0 ? null : Math.min(...times);
  });

const SHALLOW_FILE_ARGS = ["rev-parse", "--git-path", "shallow"];

/**
 * The commits a shallow clone was cut at, or undefined for a complete
 * repository. Git records such a commit as if it had added the whole tree, so
 * its changes say nothing about the files.
 *
 * Runs git inside `root`, so the `Git` service must be built for it.
 */
export const readShallowBoundary = (
  root: string,
): Effect.Effect<
  ReadonlySet<string> | undefined,
  GitError,
  Git | FileSystem.FileSystem | Path.Path
> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const git = yield* Git;
    const shallow = yield* git.text(["rev-parse", "--is-shallow-repository"]);
    if (shallow.trim() !== "true") {
      return undefined;
    }
    const file = path.resolve(
      root,
      (yield* git.text(SHALLOW_FILE_ARGS)).trim(),
    );
    const content = yield* fs.readFileString(file).pipe(
      Effect.mapError(
        (error) =>
          new GitCommandFailed({
            args: SHALLOW_FILE_ARGS,
            exitCode: -1,
            stderr: error.message,
          }),
      ),
    );
    return new Set(content.split("\n").filter((line) => line !== ""));
  });
