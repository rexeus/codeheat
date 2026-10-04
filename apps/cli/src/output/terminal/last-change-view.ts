// Owns the terminal's one line on the newest commit of the repository, for a window
// that has no counted changes to show.
import type { Report } from "@codeheat/engine";

import { day } from "./format.js";

/**
 * "No counted changes in this window; the newest commit of the repository was
 * on 2025-03-14.": the day of the newest commit (`window.lastCommitAt`), when
 * the window has no real change (`window.realCommits` is 0). It is the newest
 * commit of the repository, which need not touch the analysed files. Nothing
 * for a window with changes and for a repository without commits.
 */
export const lastChangeLines = ({
  window,
}: Pick<Report, "window">): ReadonlyArray<string> =>
  window.realCommits === 0 && window.lastCommitAt !== null
    ? [
        `No counted changes in this window; the newest commit of the repository was on ${day(window.lastCommitAt)}.`,
      ]
    : [];
