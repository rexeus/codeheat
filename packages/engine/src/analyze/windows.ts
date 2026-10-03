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

/** The latest window and, when comparing, the one right before it. */
export type Windows = {
  readonly current: TimeRange;
  readonly previous: TimeRange | null;
};

/** The history of each window; `previous` is null exactly when the windows have none. */
export type WindowHistories = {
  readonly current: History;
  readonly previous: History | null;
};

const NO_HISTORY: History = {
  paths: [],
  commits: [],
  changes: [],
  logicalChanges: { by: "commit", count: 0, largest: 0 },
  files: new Map(),
  mechanical: countKinds([]),
};

/** Resolves `compare` to two adjacent windows; without it, `since` to one. */
export const resolveWindows = (options: {
  readonly since: string;
  readonly compare?: string | undefined;
}): Effect.Effect<Windows, InvalidSince | InvalidCompare> =>
  options.compare === undefined
    ? resolveTimeRange(options.since).pipe(
        Effect.map((current) => ({ current, previous: null })),
      )
    : resolveComparisonRanges(options.compare);

/** The histories of a repository without commits. */
export const noHistories = ({ previous }: Windows): WindowHistories => ({
  current: NO_HISTORY,
  previous: previous === null ? null : NO_HISTORY,
});

/** Reads the history of every window in one pass over the log. */
export const readWindows = (
  { current, previous }: Windows,
  options: Omit<HistoryOptions, "since" | "until">,
): Effect.Effect<WindowHistories, GitError, Git> =>
  previous === null
    ? readHistory({ ...current, ...options }).pipe(
        Effect.map((history) => ({ current: history, previous: null })),
      )
    : readHistoryHalves(
        { since: previous.since, until: current.until, ...options },
        Math.floor(Date.parse(current.since) / 1000),
      ).pipe(
        Effect.map(({ recent, earlier }) => ({
          current: recent,
          previous: earlier,
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
