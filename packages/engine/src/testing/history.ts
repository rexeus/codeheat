// Tests only: reading one window of history, and two halves of it.
import { Effect } from "effect";

import type { GitError } from "../git/git-errors.js";
import type { Git } from "../git/git.js";
import { readHistories } from "../history/history.js";
import type { History, HistoryOptions } from "../history/history.js";

/** The history of the window `options` names, without a series. */
export const readHistory = (
  options: HistoryOptions,
): Effect.Effect<History, GitError, Git> =>
  readHistories(options, {
    currentFrom: Math.floor(Date.parse(options.since) / 1000),
    previousFrom: null,
    seriesSince: options.until,
  }).pipe(Effect.map(({ current }) => current));

/**
 * The window `options` names split at `splitAt`, the time in seconds since the
 * epoch: `recent` holds the commits at or after it, `earlier` those before it.
 */
export const readHistoryHalves = (
  options: HistoryOptions,
  splitAt: number,
): Effect.Effect<
  { readonly recent: History; readonly earlier: History },
  GitError,
  Git
> =>
  readHistories(options, {
    currentFrom: splitAt,
    previousFrom: Math.floor(Date.parse(options.since) / 1000),
    seriesSince: options.until,
  }).pipe(
    Effect.map(({ current, previous }) => ({
      recent: current,
      earlier: previous ?? current,
    })),
  );
