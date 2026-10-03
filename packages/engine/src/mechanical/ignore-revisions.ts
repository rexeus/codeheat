// Owns the revisions a repository asks tools to skip: the commits listed in
// `.git-blame-ignore-revs` at its root, as `git blame --ignore-revs-file` reads them.
import { Effect } from "effect";

import type { GitError } from "../git/git-errors.js";
import { Git } from "../git/git.js";

const IGNORE_FILE = ".git-blame-ignore-revs";
const OBJECT_NAME = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/u;
const TREE_ENTRY = /^(\d+) blob ([0-9a-f]+)\t/u;
const SYMLINK_MODE = "120000";

/** The full object names one per line; `#` starts a comment, blank lines and abbreviations are skipped. */
const parseIgnoreRevisions = (text: string): ReadonlySet<string> =>
  new Set(
    text
      .split(/\r?\n/u)
      .map((line) => line.replace(/#.*$/u, "").trim().toLowerCase())
      .filter((line) => OBJECT_NAME.test(line)),
  );

/**
 * The commits `.git-blame-ignore-revs` lists at `HEAD`; none when the
 * repository has no such regular file.
 */
export const readIgnoredRevisions: Effect.Effect<
  ReadonlySet<string>,
  GitError,
  Git
> = Effect.gen(function* () {
  const git = yield* Git;
  const listing = yield* git.text(["ls-tree", "HEAD", "--", IGNORE_FILE]);
  const [, mode, blob] = TREE_ENTRY.exec(listing) ?? [];
  if (blob === undefined || mode === SYMLINK_MODE) {
    return new Set<string>();
  }
  return parseIgnoreRevisions(yield* git.text(["cat-file", "blob", blob]));
});
