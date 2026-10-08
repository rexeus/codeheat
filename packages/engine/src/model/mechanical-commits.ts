// Owns the mechanical-commit part of the report contract: how many commits of
// a window the numbers leave out, per kind.
// Additive fields keep schemaVersion 1; renaming or removing a field bumps it.
import { Schema } from "effect";

import { Count } from "./scalars.js";

/**
 * Commits of the window that change the repository without changing what its
 * code does. They count in `window.commits` and carry renames forward, but add
 * no revisions, lines, or coupling evidence. A commit has one kind, the first
 * that applies in the order of the fields below; every count is a number of
 * commits inside `window.commits`.
 */
export const MechanicalCommits = Schema.Struct({
  /** Listed in the repository's `.git-blame-ignore-revs` at `HEAD`. */
  ignored: Count,
  /** Every change is a rename that kept the content (similarity 100) or a mode change. */
  renames: Count,
  /**
   * The diff is empty under `git diff -w`: only whitespace changed, in a
   * commit that touches no file of a language where indentation is syntax
   * (Python, Starlark/Bazel, F#, Haskell, Scala, YAML, Makefiles, …).
   */
  whitespace: Count,
  /**
   * Reverts and the commits they revert, counted together (two per pair),
   * when both are in the window and the revert undoes the original exactly
   * over the analyzed files (code and contract files of the universe;
   * lockfiles, generated output, and other files outside it neither break nor
   * make a pair): the same paths, mirrored line counts, and every file either
   * restored to the object it had before the original or changed by a patch
   * equal to the original's reversed (context and position are not compared;
   * a change of type never confirms). A revert whose original is outside the window, or that
   * undoes only part of it, keeps or rewrites some of it, or does other work
   * too, changes the code and counts normally.
   */
  reverts: Count,
  /**
   * Commits with the patch id of an older commit of the window that is not
   * their ancestor (cherry-picks and backports on a parallel line); the
   * oldest counts normally, and so does a re-land: the same patch applied
   * again on top of the commit that had it.
   */
  duplicates: Count,
});
