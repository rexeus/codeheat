// Owns narrowing a history to what some of its files say about who changed together with whom.
import type { History } from "./history.js";

/**
 * The history with the commits' files that lie at `paths` left out. A commit
 * keeps its `size`, so the commits that count for coupling stay the same, and
 * `files` keeps the revisions of every path: only what a commit says about
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
    commits: history.commits.map((commit) => ({
      ...commit,
      files: commit.files.filter((id) => !paths.has(history.paths[id] ?? "")),
    })),
  };
};
