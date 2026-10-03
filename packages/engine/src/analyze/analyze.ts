// Owns the one entry point that turns a repository into a Report.
// It composes inventory, history, and metrics; callers never see git or parsers.
// New signals join here as new Report fields, not as new entry points.
import { Effect, Path } from "effect";
import type { FileSystem } from "effect";
import type { ChildProcessSpawner } from "effect/process";

import type { LanguageAdapter } from "../code/language-adapter.js";
import type { GitError } from "../git/git-errors.js";
import { Git } from "../git/git.js";
import {
  readHead,
  readOldestCommitTime,
  readShallowBoundary,
  repositoryRoot,
  repositoryScope,
} from "../git/repository.js";
import type { HistoryOptions } from "../history/history.js";
import { withDepths } from "../modules/depth.js";
import type { Report } from "../report/report.js";
import type { InvalidCompare, InvalidSince } from "./analysis-window.js";
import { measureLinked } from "./measure-linked.js";
import { readUniverse } from "./read-universe.js";
import { setAsideUbiquitous } from "./set-aside-ubiquitous.js";
import {
  comparisonOf,
  noHistories,
  readWindows,
  resolveWindows,
} from "./windows.js";
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
  /**
   * The languages whose imports are read to tell hidden coupling from visible,
   * and whose exports measure module depth. A file no adapter reads leaves
   * `Coupling.imports` null, and a module with an entry point no adapter reads
   * has no `depth`.
   */
  readonly adapters: ReadonlyArray<LanguageAdapter>;
  /** Written to `Report.tool.version`. */
  readonly toolVersion: string;
};

/** The history of each window and, when comparing, the time of the oldest commit; both are empty for a repository without commits. */
const readTimeline = (
  windows: Windows,
  {
    head,
    ...options
  }: Omit<HistoryOptions, "since" | "until"> & {
    readonly head: string | null;
  },
) =>
  Effect.gen(function* () {
    const histories =
      head === null
        ? noHistories(windows)
        : yield* readWindows(windows, options);
    const oldestCommit =
      head === null || windows.previous === null
        ? null
        : yield* readOldestCommitTime;
    return { histories, oldestCommit };
  });

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
    const { depths, ...universe } = yield* readUniverse({
      ...options,
      root,
      scope,
    });
    const timeline = yield* readTimeline(windows, {
      head,
      skipCommits: shallowBoundary ?? new Set(),
      universe: new Set([
        ...universe.files.map((file) => file.path),
        ...universe.contracts.keys(),
      ]),
    });
    const { histories, ubiquitousFiles } = setAsideUbiquitous(
      timeline.histories,
      new Set(universe.contracts.keys()),
    );
    const { commits, realCommits, couplingCommits, thresholds, ...measured } =
      yield* measureLinked(
        options.adapters,
        { root, scope },
        universe,
        histories,
      );
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
      window: { ...windows.current, commits, realCommits, couplingCommits },
      comparison: comparisonOf(windows, histories, timeline.oldestCommit),
      thresholds,
      totals: {
        files: measured.files.length,
        contracts: measured.contracts.length,
        couplings: measured.couplings.length,
        modules: measured.modules.length,
      },
      ...measured,
      ubiquitousFiles,
      modules: withDepths(measured.modules, depths),
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
