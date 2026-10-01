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
import { detectModules } from "../modules/detect.js";
import { findEntryPoints } from "../modules/entry-points.js";
import { listPackageDirectories } from "../modules/package-directories.js";
import type { Report } from "../report/report.js";
import { inventory } from "../universe/inventory.js";
import type { InvalidCompare, InvalidSince } from "./analysis-window.js";
import { measureWindows } from "./measure.js";
import { noHistories, readWindows, resolveWindows } from "./windows.js";
import type { Windows } from "./windows.js";

/** Every expected failure of `analyze`. */
export type AnalyzeError = GitError | InvalidSince | InvalidCompare;

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
  /**
   * `<n>d`, `<n>w`, `<n>m`, or `<n>y`: the report describes the latest window
   * of that length, and every file and module carries how it changed against
   * the window before it. Replaces `since`.
   */
  readonly compare?: string | undefined;
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

const analyzeRepository = (
  options: AnalyzeOptions,
  root: string,
  scope: string,
  windows: Windows,
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
    const histories =
      head === null
        ? noHistories(windows)
        : yield* readWindows(windows, {
            skipCommits: shallowBoundary ?? new Set(),
            universe: new Set(files.map((file) => file.path)),
          });
    const { commits, couplingCommits, thresholds, ...measured } =
      measureWindows(files, histories, modules, entryPoints);
    return {
      schemaVersion: 1,
      tool: { name: "codeheat", version: options.toolVersion },
      generatedAt: windows.current.until,
      repository: {
        name: path.basename(root),
        head,
        scope,
        shallow: shallowBoundary !== undefined,
      },
      window: { ...windows.current, commits, couplingCommits },
      comparison:
        windows.previous === null
          ? null
          : {
              previousSince: windows.previous.since,
              previousUntil: windows.previous.until,
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
    const windows = yield* resolveWindows(options);
    const root = yield* repositoryRoot(options.cwd);
    const scope =
      options.scope === undefined
        ? "."
        : yield* repositoryScope(root, options.cwd, options.scope);
    return yield* analyzeRepository(options, root, scope, windows).pipe(
      Effect.provide(Git.layer(root)),
    );
  });
