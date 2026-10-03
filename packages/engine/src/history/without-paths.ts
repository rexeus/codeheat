// Owns narrowing a history to what some of its files say about who changed together with whom.
import type { History } from "./history.js";

/**
 * The history with the changes' files that lie at `paths` left out. A change
 * keeps its `size`, so the changes that count for coupling stay the same, and
 * `files` keeps the revisions of every path: only what a change says about
 * who changed together with whom shrinks.
 */
export const withoutPaths = (
  history: History,
  paths: ReadonlySet<string>,
): History => {
  if (paths.size === 0) {
    return history;
  }
  return {
    ...history,
    changes: history.changes.map((change) => ({
      ...change,
      files: change.files.filter((id) => !paths.has(history.paths[id] ?? "")),
    })),
  };
};
