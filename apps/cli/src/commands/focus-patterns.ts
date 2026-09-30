// Owns turning `inspect` arguments into the repository-relative patterns the engine matches.
import { repositoryRoot } from "@codeheat/engine";
import type { Report } from "@codeheat/engine";
import { Effect, FileSystem, Path } from "effect";
import picomatch from "picomatch";

const withoutLeadingDotSlash = (pattern: string): string =>
  pattern.startsWith("./") ? pattern.slice(2) : pattern;

/**
 * Rewrites every pattern without glob metacharacters into the
 * repository-relative POSIX path it names. A path resolves against `cwd`
 * (absolute paths as they are); when that names no file of the `report`, the
 * pattern as given is tried as a repository-relative path, so both spellings
 * keep working. A path that names no file either way becomes its `cwd`
 * resolution, which is what `unmatched` reports, and a path outside the
 * repository stays as given. Globs stay repository-relative.
 *
 * Fails like `repositoryRoot` when `cwd` is not inside a git repository.
 */
export const resolveFocusPatterns = (
  cwd: string,
  report: Pick<Report, "files">,
  patterns: ReadonlyArray<string>,
) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const root = yield* repositoryRoot(cwd);
    const universe = new Set(report.files.map((file) => file.path));

    const fromWorkingDirectory = (pattern: string) =>
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
          ? undefined
          : segments.join("/");
      });

    const resolveExact = (pattern: string) =>
      Effect.map(fromWorkingDirectory(pattern), (candidate) => {
        if (candidate !== undefined && universe.has(candidate)) {
          return candidate;
        }
        return universe.has(withoutLeadingDotSlash(pattern))
          ? pattern
          : (candidate ?? pattern);
      });

    return yield* Effect.forEach(patterns, (pattern) =>
      picomatch.scan(pattern).isGlob
        ? Effect.succeed(pattern)
        : resolveExact(pattern),
    );
  });
