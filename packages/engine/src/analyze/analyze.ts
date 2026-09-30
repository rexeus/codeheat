// Owns the one entry point that turns a repository into a Report.
// It composes inventory, history, and metrics; callers never see git or parsers.
// New signals join here as new Report fields, not as new entry points.
import { Effect, Path } from "effect";
import type { FileSystem } from "effect";
import type { ChildProcessSpawner } from "effect/process";

import {
  MAX_COMMIT_FILES,
  MIN_DEGREE,
  MIN_SHARED_COMMITS,
  findCouplings,
} from "../coupling/coupling.js";
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
import { rankFiles } from "../hotspots/hotspots.js";
import type { FileMeasure } from "../hotspots/hotspots.js";
import { HUB_MIN_BREADTH, HUB_TOP_SHARE } from "../hotspots/reasons.js";
import type { Report } from "../report/report.js";
import { inventory } from "../universe/inventory.js";
import type { InventoryFile } from "../universe/inventory.js";
import {
  MAX_FILE_BYTES,
  MAX_MEAN_LINE_LENGTH,
} from "../universe/source-file.js";
import { resolveTimeRange } from "./analysis-window.js";
import type { InvalidSince, TimeRange } from "./analysis-window.js";

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
  /** Written to `Report.tool.version`. */
  readonly toolVersion: string;
};

const NO_HISTORY: History = {
  paths: [],
  commits: [],
  files: new Map(),
};

const THRESHOLDS = {
  maxCommitFiles: MAX_COMMIT_FILES,
  hubMinBreadth: HUB_MIN_BREADTH,
  hubTopShare: HUB_TOP_SHARE,
  minSharedCommits: MIN_SHARED_COMMITS,
  minDegree: MIN_DEGREE,
  maxMeanLineLength: MAX_MEAN_LINE_LENGTH,
  maxFileBytes: MAX_FILE_BYTES,
} satisfies Report["thresholds"];

/** Every universe file with the window's activity on it, none for untouched files. */
const measureFiles = (
  files: ReadonlyArray<InventoryFile>,
  history: History,
  breadth: ReadonlyMap<string, number>,
): ReadonlyArray<FileMeasure> =>
  files.map(({ path, complexity }) => {
    const activity = history.files.get(path);
    return {
      path,
      revisions: activity?.revisions ?? 0,
      linesAdded: activity?.linesAdded ?? 0,
      linesDeleted: activity?.linesDeleted ?? 0,
      breadth: breadth.get(path) ?? 0,
      complexity,
    };
  });

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
    const history =
      head === null
        ? NO_HISTORY
        : yield* readHistory({
            ...range,
            skipCommits: shallowBoundary ?? new Set(),
            universe: new Set(files.map((file) => file.path)),
          });
    const { couplingCommits, couplings, breadth } = findCouplings(
      history.commits,
      history.paths,
      new Map(
        [...history.files].map(([file, activity]) => [
          file,
          activity.revisions,
        ]),
      ),
    );
    const ranked = rankFiles(measureFiles(files, history, breadth), couplings);
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
      window: { ...range, commits: history.commits.length, couplingCommits },
      thresholds: THRESHOLDS,
      totals: { files: ranked.length, couplings: couplings.length },
      files: ranked,
      couplings,
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
