// Owns taking the ubiquitous contract files (see `findUbiquitous`) out of what
// the windows say about who changes together with whom.
import { findUbiquitous } from "../contracts/ubiquitous.js";
import type { History } from "../history/history.js";
import { withoutPaths } from "../history/without-paths.js";
import type { UbiquitousFile } from "../report/contract-file.js";
import type { WindowHistories } from "./windows.js";

const without = (
  history: History,
  found: ReadonlyArray<UbiquitousFile>,
): History => withoutPaths(history, new Set(found.map(({ path }) => path)));

/**
 * Leaves the contract files of `contracts` that are ubiquitous in a window out
 * of that window's commits, so they join no pair, breadth, or cohesion of
 * it. Each window is judged on its own commits. `ubiquitousFiles` are those of
 * the latest window, which the report describes.
 */
export const setAsideUbiquitous = (
  histories: WindowHistories,
  contracts: ReadonlySet<string>,
): {
  readonly histories: WindowHistories;
  readonly ubiquitousFiles: ReadonlyArray<UbiquitousFile>;
} => {
  const ubiquitousFiles = findUbiquitous(histories.current, contracts);
  return {
    histories: {
      ...histories,
      current: without(histories.current, ubiquitousFiles),
      previous:
        histories.previous === null
          ? null
          : without(
              histories.previous,
              findUbiquitous(histories.previous, contracts),
            ),
    },
    ubiquitousFiles,
  };
};
