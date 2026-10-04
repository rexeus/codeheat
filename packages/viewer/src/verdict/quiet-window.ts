// Owns what the first screen says when the window holds no counted change:
// that there is nothing to judge, when the history last changed, and what to
// do about it. The report carries no date for its newest commit, so "when" is
// the span of the latest window of `Report.series` that has counted changes.
import type { Report } from "@codeheat/engine";

import { formatDay } from "../render/format.js";

/** The sentence and the line under it for a window without counted changes. */
export type QuietWindow = {
  readonly sentence: string;
  readonly note: string;
};

const SENTENCE =
  "No counted changes in this window, so there is nothing to judge.";

/** Where the history last changed, as far as the series says, and the flag that reaches it. */
const noteOf = ({ series, seriesSince }: Report): string => {
  const last = series.findLast(({ changes }) => changes > 0);
  if (last !== undefined) {
    return `The last counted changes fall between ${formatDay(last.since)} and ${formatDay(last.until)}. A longer window, set with --since, would include them.`;
  }
  return seriesSince === null
    ? "Try a longer window with --since."
    : `The history from ${formatDay(seriesSince)} on has no counted changes either; try a longer window with --since.`;
};

/** What to say about a window without a real change; `null` when the window has one. */
export const quietWindowOf = (report: Report): QuietWindow | null =>
  report.window.realCommits === 0
    ? { sentence: SENTENCE, note: noteOf(report) }
    : null;
