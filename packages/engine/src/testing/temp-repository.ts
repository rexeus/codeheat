// Tests only: a real git repository in a temporary directory, isolated from
// the machine's git configuration, with commits at fixed dates.
import { Effect, FileSystem, Path } from "effect";
import type { PlatformError, Scope } from "effect";
import type { ChildProcessSpawner } from "effect/process";

import { Git } from "../git/git.js";
import { setScopedEnv } from "./scoped-env.js";

export type TempRepository = {
  readonly directory: string;
  /** Runs `git <args>` in the repository and returns its stdout; a failure is a defect. */
  readonly git: (...args: ReadonlyArray<string>) => Effect.Effect<string>;
  /**
   * Runs `git <args>` with author and committer dates set to `date` (ISO
   * 8601), for commands that create a commit, such as `merge`, `revert`, and
   * `cherry-pick`.
   */
  readonly gitAt: (
    date: string,
    ...args: ReadonlyArray<string>
  ) => Effect.Effect<string>;
  /**
   * Writes `files` (relative path to content, creating directories), stages
   * every change in the work tree, and commits at `date` (ISO 8601) with
   * `message`. Commits even when nothing changed.
   */
  readonly commit: (
    date: string,
    files?: Readonly<Record<string, string | Uint8Array>>,
    message?: string,
  ) => Effect.Effect<void>;
};

/**
 * Creates a repository that is deleted when the scope closes.
 *
 * Git configuration of the machine is ignored for the scope's lifetime, also
 * for git processes the code under test starts.
 */
export const makeTempRepository: Effect.Effect<
  TempRepository,
  PlatformError.PlatformError,
  | FileSystem.FileSystem
  | Path.Path
  | ChildProcessSpawner.ChildProcessSpawner
  | Scope.Scope
> = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  yield* setScopedEnv({
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_CONFIG_NOSYSTEM: "1",
  });
  const directory = yield* fs.makeTempDirectoryScoped({ prefix: "codeheat-" });
  const git = yield* Git.make(directory);
  const run = (...args: ReadonlyArray<string>) =>
    git.text(args).pipe(Effect.orDie);

  yield* run("init", "--quiet");
  yield* run("config", "user.name", "Codeheat Test");
  yield* run("config", "user.email", "test@codeheat.invalid");
  yield* run("config", "commit.gpgsign", "false");

  const write = (file: string, content: string | Uint8Array) =>
    Effect.gen(function* () {
      const target = path.join(directory, file);
      yield* fs.makeDirectory(path.dirname(target), { recursive: true });
      yield* fs.writeFile(
        target,
        typeof content === "string"
          ? new TextEncoder().encode(content)
          : content,
      );
    });

  const gitAt = (date: string, ...args: ReadonlyArray<string>) =>
    Effect.scoped(
      Effect.gen(function* () {
        yield* setScopedEnv({
          GIT_AUTHOR_DATE: date,
          GIT_COMMITTER_DATE: date,
        });
        return yield* run(...args);
      }),
    );

  const commit = (
    date: string,
    files: Readonly<Record<string, string | Uint8Array>> = {},
    message = "test",
  ) =>
    Effect.gen(function* () {
      for (const [file, content] of Object.entries(files)) {
        yield* write(file, content);
      }
      yield* run("add", "--all");
      yield* gitAt(
        date,
        "commit",
        "--quiet",
        "--allow-empty",
        "--message",
        message,
      );
    }).pipe(Effect.orDie);

  return { directory, git: run, gitAt, commit };
});
