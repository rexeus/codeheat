// Owns turning `inspect` arguments into the repository-relative patterns the engine matches.
import { repositoryRoot } from "@codeheat/engine";
import { Effect, FileSystem, Path } from "effect";
import picomatch from "picomatch";

/**
 * Rewrites every pattern without glob metacharacters into the
 * repository-relative POSIX path it names, resolving it against `cwd`
 * (absolute paths resolve as they are). Globs stay repository-relative, and a
 * path outside the repository stays as given, so it ends up unmatched.
 *
 * Fails like `repositoryRoot` when `cwd` is not inside a git repository.
 */
export const resolveFocusPatterns = (
  cwd: string,
  patterns: ReadonlyArray<string>,
) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const root = yield* repositoryRoot(cwd);

    const toRepositoryPath = (pattern: string) =>
      Effect.gen(function* () {
        const absolute = path.resolve(cwd, pattern);
        // git reports the real path of the root, so compare real directories.
        const directory = yield* fs
          .realPath(path.dirname(absolute))
          .pipe(Effect.orElseSucceed(() => path.dirname(absolute)));
        const relative = path.relative(
          root,
          path.join(directory, path.basename(absolute)),
        );
        const segments = relative.split(path.sep);
        return relative === "" ||
          segments[0] === ".." ||
          path.isAbsolute(relative)
          ? pattern
          : segments.join("/");
      });

    return yield* Effect.forEach(patterns, (pattern) =>
      picomatch.scan(pattern).isGlob
        ? Effect.succeed(pattern)
        : toRepositoryPath(pattern),
    );
  });
