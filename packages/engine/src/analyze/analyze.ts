// Owns the one entry point that turns a repository into a Report.
// It composes inventory, history, and metrics; callers never see git or parsers.
// New signals join here as new Report fields, not as new entry points.
import { Effect, Path } from "effect";
import type { FileSystem } from "effect";
import type { ChildProcessSpawner } from "effect/process";

import type { GitError } from "../git/git-errors.js";
import { Git } from "../git/git.js";
import {
  readHead,
  readShallowBoundary,
  repositoryRoot,
  repositoryScope,
} from "../git/repository.js";
import { readHistory } from "../history/history.js";
import type { History } from "../history/history.js";
import { detectModules } from "../modules/detect.js";
import { findEntryPoints } from "../modules/entry-points.js";
import { listPackageDirectories } from "../modules/package-directories.js";
import type { Report } from "../report/report.js";
import { inventory } from "../universe/inventory.js";
import { resolveTimeRange } from "./analysis-window.js";
import type { InvalidSince, TimeRange } from "./analysis-window.js";
import { measure } from "./measure.js";

/** Every expected failure of `analyze`. */
export type AnalyzeError = GitError | InvalidSince;

export type AnalyzeOptions = {
  /** A directory inside the repository; git locates the work tree from here. */
  readonly cwd: string;
  /**
   * A directory or file, absolute or relative to `cwd`, that limits the universe to
   * files under it. Absent, the universe is the whole repository.
   */
  readonly scope?: string | undefined;
  /** `<n>d`, `<n>w`, `<n>m`, `<n>y`, or an ISO date (`YYYY-MM-DD`), resolved against `Clock`. */
  readonly since: string;
  /** Globs that replace the language allow-list when non-empty. */
  readonly include: ReadonlyArray<string>;
  /** Globs removed from the universe after `include`. */
  readonly exclude: ReadonlyArray<string>;
  /**
   * Globs of the files that make up each module's interface; when non-empty
   * they replace entry-point detection from `package.json` and conventions.
   */
  readonly entry: ReadonlyArray<string>;
  /** Written to `Report.tool.version`. */
  readonly toolVersion: string;
};

const NO_HISTORY: History = {
  paths: [],
  commits: [],
  files: new Map(),
};

const analyzeRepository = (
  options: AnalyzeOptions,
  root: string,
  scope: string,
  range: TimeRange,
) =>
  Effect.gen(function* () {
    const path = yield* Path.Path;
    const head = yield* readHead;
    const shallowBoundary = yield* readShallowBoundary(root);
    const files = yield* inventory({
      root,
      scope,
      include: options.include,
      exclude: options.exclude,
    });
    const modules = detectModules(
      files.map((file) => file.path),
      yield* listPackageDirectories(scope),
    );
    const entryPoints = yield* findEntryPoints(root, modules, options.entry);
    const history =
      head === null
        ? NO_HISTORY
        : yield* readHistory({
            ...range,
            skipCommits: shallowBoundary ?? new Set(),
            universe: new Set(files.map((file) => file.path)),
          });
    const { couplingCommits, thresholds, ...measured } = measure(
      files,
      history,
      modules,
      entryPoints,
    );
    return {
      schemaVersion: 1,
      tool: { name: "codeheat", version: options.toolVersion },
      generatedAt: range.until,
      repository: {
        name: path.basename(root),
        head,
        scope,
        shallow: shallowBoundary !== undefined,
      },
      window: {
        ...range,
        commits: history.commits.length,
        couplingCommits,
      },
      thresholds,
      totals: {
        files: measured.files.length,
        couplings: measured.couplings.length,
        modules: measured.modules.length,
      },
      ...measured,
    } satisfies Report;
  });

/**
 * Analyzes the git repository containing `options.cwd`.
 *
 * The report lists every universe file and every coupling above the
 * thresholds, unlimited; output limits belong to the caller.
 */
export const analyze = (
  options: AnalyzeOptions,
): Effect.Effect<
  Report,
  AnalyzeError,
  ChildProcessSpawner.ChildProcessSpawner | FileSystem.FileSystem | Path.Path
> =>
  Effect.gen(function* () {
    const range = yield* resolveTimeRange(options.since);
    const root = yield* repositoryRoot(options.cwd);
    const scope =
      options.scope === undefined
        ? "."
        : yield* repositoryScope(root, options.cwd, options.scope);
    return yield* analyzeRepository(options, root, scope, range).pipe(
      Effect.provide(Git.layer(root)),
    );
  });
