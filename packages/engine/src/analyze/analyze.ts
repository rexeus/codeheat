// Owns the one entry point that turns a repository into a Report.
// It composes inventory, history, and metrics; callers never see git or parsers.
// New signals join here as new Report fields, not as new entry points.
import { Effect } from "effect";
import type { FileSystem, Path } from "effect";
import type { ChildProcessSpawner } from "effect/process";

import type { LanguageAdapter } from "../code/language-adapter.js";
import type { GitError } from "../git/git-errors.js";
import { Git } from "../git/git.js";
import { readRepositoryName } from "../git/repository-name.js";
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
import { judgeVerdict } from "../verdict/judge-verdict.js";
import type { InvalidCompare, InvalidSince } from "./analysis-window.js";
import { measureLinked } from "./measure-linked.js";
import { readUniverse } from "./read-universe.js";
import { setAsideUbiquitous } from "./set-aside-ubiquitous.js";
import {
  comparisonOf,
  noHistories,
  readWindows,
  reportWindow,
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

/** The history of each window and of the series, and the time of the oldest commit; empty for a repository without commits. */
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
    const oldestCommit = head === null ? null : yield* readOldestCommitTime;
    const histories =
      head === null
        ? noHistories(windows)
        : yield* readWindows(windows, options, oldestCommit);
    return { histories, oldestCommit };
  });

/** The report's `totals`: how many of each list the report holds before any limit. */
const totalsOf = ({
  files,
  contracts,
  couplings,
  modules,
}: Pick<Report, "files" | "contracts" | "couplings" | "modules">) => ({
  files: files.length,
  contracts: contracts.length,
  couplings: couplings.length,
  modules: modules.length,
});

/**
 * The report's `verdict`, judged from what the analysis measured; `windows`
 * are the territories each counted change of each series window touched.
 */
const verdictOf = (
  { territories, thresholds }: Pick<Report, "territories" | "thresholds">,
  windows: ReadonlyArray<ReadonlyArray<ReadonlySet<string>>>,
  realCommits: number,
) => judgeVerdict({ territories, windows, realCommits, limits: thresholds });

/** The report's `repository`, with the `HEAD` and the shallow boundary it is read from. */
const readRepository = (root: string, scope: string) =>
  Effect.gen(function* () {
    const head = yield* readHead;
    const shallowBoundary = yield* readShallowBoundary(root);
    return {
      head,
      shallowBoundary,
      repository: {
        name: yield* readRepositoryName,
        head: head?.commit ?? null,
        scope,
        shallow: shallowBoundary !== undefined,
      },
    };
  });

const analyzeRepository = (
  options: AnalyzeOptions,
  root: string,
  scope: string,
  windows: Windows,
) =>
  Effect.gen(function* () {
    const { head, shallowBoundary, repository } = yield* readRepository(
      root,
      scope,
    );
    const { depths, generated, ...universe } = yield* readUniverse({
      ...options,
      root,
      scope,
    });
    const timeline = yield* readTimeline(windows, {
      head: head?.commit ?? null,
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
    const {
      commits,
      realCommits,
      couplingCommits,
      thresholds,
      areaWindows,
      ...measured
    } = yield* measureLinked(
      options.adapters,
      { root, scope },
      universe,
      histories,
    );
    return {
      schemaVersion: 1,
      tool: { name: "codeheat", version: options.toolVersion },
      generatedAt: windows.current.until,
      repository,
      window: reportWindow(
        windows.current,
        { commits, realCommits, couplingCommits },
        head,
      ),
      comparison: comparisonOf(windows, histories, timeline.oldestCommit),
      verdict: verdictOf({ ...measured, thresholds }, areaWindows, realCommits),
      thresholds,
      totals: { ...totalsOf(measured), generated },
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
