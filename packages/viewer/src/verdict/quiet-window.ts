// Owns what the first screen says when the window holds no counted change:
// that there is nothing to judge, when the history last changed, and what to
// do about it. "When" is the day of the newest commit of the repository
// (`window.lastCommitAt`); a report without it falls back to the span of the
// latest window of `Report.series` that has counted changes.
import type { Report } from "@codeheat/engine";

import { formatDay } from "../render/format.js";

/** The sentence and the line under it for a window without counted changes. */
export type QuietWindow = {
  readonly sentence: string;
  readonly note: string;
};

const SENTENCE =
  "No counted changes in this window, so there is nothing to judge.";

/** The line for a window whose newest commit lies before it: its day, and that a longer window reaches back to it. It is the newest commit of the repository, which need not touch the analysed files. */
const olderCommitNote = (lastCommitAt: string): string =>
  `The newest commit of the repository was on ${formatDay(lastCommitAt)}, before this window starts. A longer window, set with --since, reaches back to it.`;

/** The line for a window of commits that are all mechanical: they do not count, and the day of the newest commit. */
const mechanicalNote = (lastCommitAt: string): string =>
  `The commits of this window are mechanical and do not count; the newest commit of the repository was on ${formatDay(lastCommitAt)}.`;

/** Where the history last changed, as far as the series says, and the flag that reaches it. */
const seriesNote = ({ series, seriesSince }: Report): string => {
  const last = series.findLast(({ changes }) => changes > 0);
  if (last !== undefined) {
    return `The last counted changes fall between ${formatDay(last.since)} and ${formatDay(last.until)}. A longer window, set with --since, would include them.`;
  }
  return seriesSince === null
    ? "Try a longer window with --since."
    : `The history from ${formatDay(seriesSince)} on has no counted changes either; try a longer window with --since.`;
};

/**
 * When the history last changed. The day of the newest commit says it only
 * when it explains the empty window: a commit before the window starts, or a
 * window of mechanical commits. A newest commit inside a window that holds no
 * commit at all touched no analysed file (a documentation-only commit, a
 * scoped analysis), so the series says where the analysed code last changed.
 * A report without the date falls back to the series too.
 */
const noteOf = (report: Report): string => {
  const { lastCommitAt, since, commits } = report.window;
  if (lastCommitAt === null) {
    return seriesNote(report);
  }
  if (lastCommitAt < since) {
    return olderCommitNote(lastCommitAt);
  }
  return commits > 0 ? mechanicalNote(lastCommitAt) : seriesNote(report);
};

/** What to say about a window without a real change; `null` when the window has one. */
export const quietWindowOf = (report: Report): QuietWindow | null =>
  report.window.realCommits === 0
    ? { sentence: SENTENCE, note: noteOf(report) }
    : null;
