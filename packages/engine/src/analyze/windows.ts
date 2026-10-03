// Owns the windows an analysis covers and reading their history in one pass.
import { Effect } from "effect";

import type { GitError } from "../git/git-errors.js";
import type { Git } from "../git/git.js";
import {
  readHistory,
  readHistoryHalves,
  realCommitCount,
} from "../history/history.js";
import type { History, HistoryOptions } from "../history/history.js";
import { countKinds } from "../mechanical/kinds.js";
import type { Report } from "../report/report.js";
import {
  resolveComparisonRanges,
  resolveTimeRange,
} from "./analysis-window.js";
import type {
  InvalidCompare,
  InvalidSince,
  TimeRange,
} from "./analysis-window.js";
import { DEFAULT_HALF_LIFE, resolveHalfLife } from "./half-life.js";
import type { InvalidHalfLife } from "./half-life.js";

/** Every expected failure of `resolveWindows`. */
export type WindowsError = InvalidSince | InvalidCompare | InvalidHalfLife;

/** The latest window and, when comparing, the one right before it, and how their commits weigh. */
export type Windows = {
  readonly current: TimeRange;
  readonly previous: TimeRange | null;
  /** The half-life of a change's weight in days; 0: every change weighs 1. */
  readonly halfLifeDays: number;
};

/** The history of each window; `previous` is null exactly when the windows have none. */
export type WindowHistories = {
  readonly current: History;
  readonly previous: History | null;
  /** The half-life in days the commits' weights were computed with. */
  readonly halfLifeDays: number;
};

const NO_HISTORY: History = {
  paths: [],
  commits: [],
  changes: [],
  logicalChanges: { by: "commit", count: 0, largest: 0 },
  files: new Map(),
  mechanical: countKinds([]),
};

const resolveRanges = (options: {
  readonly since: string;
  readonly compare?: string | undefined;
}) =>
  options.compare === undefined
    ? resolveTimeRange(options.since).pipe(
        Effect.map((current) => ({ current, previous: null })),
      )
    : resolveComparisonRanges(options.compare);

/**
 * Resolves `compare` to two adjacent windows; without it, `since` to one. The
 * half-life defaults to `DEFAULT_HALF_LIFE`.
 */
export const resolveWindows = (options: {
  readonly since: string;
  readonly compare?: string | undefined;
  readonly halfLife?: string | undefined;
}): Effect.Effect<Windows, WindowsError> =>
  Effect.gen(function* () {
    const ranges = yield* resolveRanges(options);
    const halfLifeDays = yield* resolveHalfLife(
      options.halfLife ?? DEFAULT_HALF_LIFE,
    );
    return { ...ranges, halfLifeDays };
  });

/** The histories of a repository without commits. */
export const noHistories = ({
  previous,
  halfLifeDays,
}: Windows): WindowHistories => ({
  current: NO_HISTORY,
  previous: previous === null ? null : NO_HISTORY,
  halfLifeDays,
});

/** Reads the history of every window in one pass over the log. */
export const readWindows = (
  { current, previous, halfLifeDays }: Windows,
  options: Omit<HistoryOptions, "since" | "until" | "halfLifeDays">,
): Effect.Effect<WindowHistories, GitError, Git> =>
  previous === null
    ? readHistory({ ...current, ...options, halfLifeDays }).pipe(
        Effect.map((history) => ({
          current: history,
          previous: null,
          halfLifeDays,
        })),
      )
    : readHistoryHalves(
        {
          since: previous.since,
          until: current.until,
          ...options,
          halfLifeDays,
        },
        Math.floor(Date.parse(current.since) / 1000),
      ).pipe(
        Effect.map(({ recent, earlier }) => ({
          current: recent,
          previous: earlier,
          halfLifeDays,
        })),
      );

/**
 * The report's `comparison` for the windows and their histories: null unless
 * comparing. `oldestCommit` is the time in seconds since the epoch of the
 * oldest reachable commit, null for a repository without commits.
 */
export const comparisonOf = (
  { previous }: Windows,
  histories: WindowHistories,
  oldestCommit: number | null,
): Report["comparison"] =>
  previous === null || histories.previous === null
    ? null
    : {
        previousSince: previous.since,
        previousUntil: previous.until,
        previousCommits: histories.previous.commits.length,
        previousRealCommits: realCommitCount(histories.previous),
        previousTruncated:
          oldestCommit !== null &&
          Date.parse(previous.since) < oldestCommit * 1000,
      };
