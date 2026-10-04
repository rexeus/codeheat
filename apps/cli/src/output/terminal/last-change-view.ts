// Owns the terminal's one line on when the code last changed, for a window
// that has no counted changes to show.
import type { Report } from "@codeheat/engine";

import { day } from "./format.js";

/**
 * "No counted changes in this window; the last commit was on 2025-03-14.":
 * the day of the newest commit of the repository (`window.lastCommitAt`), when
 * the window has no real change (`window.realCommits` is 0), so that an empty
 * report says since when the code is quiet. Nothing for a window with changes
 * and for a repository without commits.
 */
export const lastChangeLines = ({
  window,
}: Pick<Report, "window">): ReadonlyArray<string> =>
  window.realCommits === 0 && window.lastCommitAt !== null
    ? [
        `No counted changes in this window; the last commit was on ${day(window.lastCommitAt)}.`,
      ]
    : [];
