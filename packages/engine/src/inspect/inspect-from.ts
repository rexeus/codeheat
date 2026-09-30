// Owns reading inspect arguments the way a user types them in a working directory.
// Exact paths become repository-relative; the matching itself stays in `inspect`.
import { Effect, FileSystem, Path } from "effect";
import type { ChildProcessSpawner } from "effect/process";

import type { GitError } from "../git/git-errors.js";
import { repositoryRoot, repositoryScope } from "../git/repository.js";
import type { InspectResult } from "../report/inspect-result.js";
import type { Report } from "../report/report.js";
import { isGlob } from "../universe/globs.js";
import { inspect } from "./inspect.js";

type Request = { readonly original: string; readonly resolved: string };

const isAnchored = (path: Path.Path, pattern: string): boolean =>
  path.isAbsolute(pattern) ||
  pattern.startsWith("./") ||
  pattern.startsWith("../");

/**
 * The repository-relative reading of a pattern without glob metacharacters.
 * The path relative to `cwd` wins. Only an unanchored path (not absolute, not
 * starting with `./` or `../`) that does not exist there is read as already
 * repository-relative. A path outside the repository stays as given.
 */
const resolveExact = (root: string, cwd: string, pattern: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const exists = yield* fs
      .exists(path.resolve(cwd, pattern))
      .pipe(Effect.orElseSucceed(() => false));
    if (!exists && !isAnchored(path, pattern)) {
      return pattern;
    }
    return yield* repositoryScope(root, cwd, pattern).pipe(
      Effect.catchTag("NotAGitRepository", () => Effect.succeed(pattern)),
    );
  });

/** The requested spellings of the resolved patterns that stayed unmatched, in request order. */
const originalsOf = (
  requests: ReadonlyArray<Request>,
  unmatched: ReadonlyArray<string>,
): ReadonlyArray<string> => {
  // `inspect` lists unmatched patterns in request order, so one pass pairs them up.
  const originals: Array<string> = [];
  for (const { original, resolved } of requests) {
    if (unmatched[originals.length] === resolved) {
      originals.push(original);
    }
  }
  return originals;
};

/**
 * Like `inspect`, for patterns typed in `cwd`. A pattern with glob
 * metacharacters is a repository-relative glob. Any other pattern is a path:
 * absolute, relative to `cwd`, or repository-relative when it does not start
 * with `./` or `../` and nothing exists at that place under `cwd`. `unmatched`
 * lists the patterns exactly as requested.
 *
 * Fails with `NotAGitRepository` when `cwd` is outside a work tree and with
 * `GitNotFound` when git is not installed.
 */
export const inspectFrom = (options: {
  /** A directory inside the repository that `report` describes. */
  readonly cwd: string;
  /** An unlimited report, as `analyze` returns it. */
  readonly report: Report;
  readonly patterns: ReadonlyArray<string>;
}): Effect.Effect<
  InspectResult,
  GitError,
  ChildProcessSpawner.ChildProcessSpawner | FileSystem.FileSystem | Path.Path
> =>
  Effect.gen(function* () {
    const { cwd, report, patterns } = options;
    const root = yield* repositoryRoot(cwd);
    const requests = yield* Effect.forEach(patterns, (original) =>
      Effect.map(
        isGlob(original)
          ? Effect.succeed(original)
          : resolveExact(root, cwd, original),
        (resolved): Request => ({ original, resolved }),
      ),
    );
    const result = inspect(
      report,
      requests.map((request) => request.resolved),
    );
    return { ...result, unmatched: originalsOf(requests, result.unmatched) };
  });
