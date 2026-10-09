// Owns reading what one window of the series says about which files are hot.
import type { History } from "../history/history.js";
import type { Complexity } from "../metrics/complexity.js";
import type { HeatWindow } from "./classify-heat.js";
import { hotFiles } from "./hot-files.js";

/**
 * The files `history` (one window) touched and, for an active window, which of
 * them are hot. `files` are the code files of the universe with their
 * complexity (test code is none of them).
 */
export const heatWindow = (
  files: ReadonlyArray<{
    readonly path: string;
    readonly complexity: Complexity;
  }>,
  history: Pick<History, "files">,
  active: boolean,
): HeatWindow => ({
  active,
  touched: new Set(history.files.keys()),
  hot: active
    ? hotFiles(
        files.flatMap(({ path, complexity }) => {
          const revisions = history.files.get(path)?.revisions ?? 0;
          return revisions > 0 ? [{ path, revisions, complexity }] : [];
        }),
      )
    : new Set(),
});
