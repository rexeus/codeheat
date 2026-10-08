// Owns the first lines of the terminal's `analyze` view: the summary of the
// repository, window, and universe, and what the window says about change.
import type { Analysis } from "@codeheat/engine";

import { escapeForTerminal } from "../escape.js";
import { contractNote } from "./contract-view.js";
import { day } from "./format.js";
import { lastChangeLines } from "./last-change-view.js";
import { spreadLines } from "./spread-view.js";
import type { Style } from "./style.js";

/**
 * The summary line (repository name, window, commits, files, and contract
 * files), bold, then the day of the repository's newest commit for a window
 * without counted changes (see `lastChangeLines`) and how far a change spreads
 * (see `spreadLines`). The repository name is made safe to print.
 */
export const summaryLines = (
  report: Analysis,
  style: Style,
): ReadonlyArray<string> => [
  style.bold(
    `${escapeForTerminal(report.repository.name)}  ${day(report.window.since)} to ${day(report.window.until)}  ${report.window.commits} commits, ${report.totals.files} files${contractNote(report)}`,
  ),
  ...lastChangeLines(report),
  ...spreadLines(report),
];
