// Owns running git: one service per repository directory over ChildProcessSpawner.
// Output is streamed as decoded text so large logs never sit in memory as one string.
// A non-zero exit becomes a GitCommandFailed; a missing binary becomes GitNotFound.
import { Context, Effect, Fiber, Layer, Stream } from "effect";
import type { PlatformError } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";

import { GitCommandFailed, GitNotFound } from "./git-errors.js";
import type { GitError } from "./git-errors.js";

type Spawner = ChildProcessSpawner.ChildProcessSpawner["Service"];
type Handle = ChildProcessSpawner.ChildProcessHandle;

const spawnFailure = (
  args: ReadonlyArray<string>,
  error: PlatformError.PlatformError,
): GitError =>
  error.reason._tag === "NotFound" &&
  "module" in error.reason &&
  error.reason.module === "ChildProcess"
    ? new GitNotFound()
    : new GitCommandFailed({ args, exitCode: -1, stderr: error.message });

/** Fails with git's exit code and stderr unless the process exited with 0. */
const failUnlessSuccessful = (
  args: ReadonlyArray<string>,
  handle: Handle,
  stderr: Fiber.Fiber<string>,
): Effect.Effect<void, GitError> =>
  handle.exitCode.pipe(
    Effect.mapError((error) => spawnFailure(args, error)),
    Effect.flatMap((exitCode): Effect.Effect<void, GitError> =>
      exitCode === 0
        ? Effect.void
        : Fiber.join(stderr).pipe(
            Effect.flatMap((text) =>
              Effect.fail(
                new GitCommandFailed({ args, exitCode, stderr: text.trim() }),
              ),
            ),
          ),
    ),
  );

const runStreaming = (
  spawner: Spawner,
  directory: string,
  args: ReadonlyArray<string>,
  stdin: string | undefined,
): Stream.Stream<string, GitError> =>
  Stream.unwrap(
    Effect.gen(function* () {
      const command = ChildProcess.make("git", args, {
        cwd: directory,
        stdin:
          stdin === undefined
            ? "ignore"
            : Stream.encodeText(Stream.make(stdin)),
      });
      const handle = yield* spawner
        .spawn(command)
        .pipe(Effect.mapError((error) => spawnFailure(args, error)));
      // Drained concurrently so a chatty stderr cannot stall stdout.
      const stderr = yield* Stream.mkString(
        Stream.decodeText(handle.stderr),
      ).pipe(
        Effect.orElseSucceed(() => ""),
        Effect.forkScoped,
      );
      return Stream.decodeText(handle.stdout).pipe(
        Stream.mapError((error) => spawnFailure(args, error)),
        Stream.concat(
          Stream.drain(
            Stream.fromEffect(failUnlessSuccessful(args, handle, stderr)),
          ),
        ),
      );
    }),
  );

/** Runs git in one directory. */
export class Git extends Context.Service<
  Git,
  {
    /**
     * Decoded stdout of `git <args>`, emitted as it arrives. `stdin`, when
     * given, is written to the process. Fails after the last chunk if git
     * exits non-zero.
     */
    stream(
      args: ReadonlyArray<string>,
      stdin?: string,
    ): Stream.Stream<string, GitError>;
    /** The whole stdout of `git <args>`; fails if git exits non-zero. */
    text(
      args: ReadonlyArray<string>,
      stdin?: string,
    ): Effect.Effect<string, GitError>;
  }
>()("@codeheat/engine/git/Git") {
  /** The service for git commands run inside `directory`. */
  static readonly make = (directory: string) =>
    Effect.gen(function* () {
      const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
      return Git.of({
        stream: (args, stdin) => runStreaming(spawner, directory, args, stdin),
        text: (args, stdin) =>
          Stream.mkString(runStreaming(spawner, directory, args, stdin)),
      });
    });

  static readonly layer = (directory: string) =>
    Layer.effect(Git, Git.make(directory));
}
