// Owns turning the `analyze` path argument into where git runs and what is in scope.
import { Effect, FileSystem, Option, Path } from "effect";

import { PathNotFound } from "../errors/path-not-found.js";

/** Where an analysis runs: `cwd` locates the repository, `scope` limits the universe. */
export type AnalysisTarget = {
  readonly cwd: string;
  readonly scope: string | undefined;
};

/**
 * Resolves `argument` against `cwd`. A directory both locates the repository
 * and limits the analysis to files under it; a file limits it to that file
 * and locates the repository from the directory containing it. Without an
 * argument the whole repository around `cwd` is analyzed.
 *
 * Fails with `PathNotFound` when the path does not exist.
 */
export const resolveAnalysisTarget = (
  cwd: string,
  argument: Option.Option<string>,
): Effect.Effect<
  AnalysisTarget,
  PathNotFound,
  FileSystem.FileSystem | Path.Path
> =>
  Effect.gen(function* () {
    if (Option.isNone(argument)) {
      return { cwd, scope: undefined };
    }
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const scope = path.resolve(cwd, argument.value);
    const info = yield* fs
      .stat(scope)
      .pipe(Effect.mapError(() => new PathNotFound({ path: scope })));
    return {
      cwd: info.type === "Directory" ? scope : path.dirname(scope),
      scope,
    };
  });
