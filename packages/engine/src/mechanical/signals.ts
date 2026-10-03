// Owns what a commit shows about itself that can make it mechanical, before
// git is asked anything more.
import type { Commit } from "../history/parse-log.js";
import { isIndentationSignificant } from "../universe/languages.js";
import { hashText } from "./hash.js";

/** What a commit did to one analyzed file, from its raw entry. */
export type FileChange = {
  /** The path before the commit; the path itself unless the commit renamed the file. */
  readonly from: string;
  /** The path after the commit. */
  readonly to: string;
  /** The object ids of the file before and after; all zeros for a side that does not exist. */
  readonly blobs: { readonly old: string; readonly new: string } | undefined;
  /** The commit changed the file's type, such as a file into a symlink. */
  readonly typeChanged: boolean;
};

export type CommitSignals = {
  readonly sha: string;
  /** Commit time in seconds since the epoch. */
  readonly time: number;
  /** Every change is an exact rename or a mode change (`Commit.moveOnly`). */
  readonly moveOnly: boolean;
  /** The commit its message says it reverts. */
  readonly reverts: string | undefined;
  /**
   * The analyzed (universe) paths the commit touches, a rename's old path
   * included; empty unless the commit is a revert, the only one that is
   * compared to another commit's patch.
   */
  readonly touchedPaths: ReadonlySet<string>;
  /**
   * What the commit did to each analyzed file, kept only for a revert and for
   * a commit that a revert seen before it names, the pairs that can be
   * confirmed by object ids; undefined for every other commit.
   */
  readonly fileChanges: ReadonlyArray<FileChange> | undefined;
  /**
   * A hash of the changes to analyzed (universe) files: path, rename, and
   * lines added and deleted. Files outside the universe, such as lockfiles and
   * generated output, are left out.
   */
  readonly shape: number;
  /**
   * The `shape` the commit would have if it were undone: every analyzed path
   * with its lines added and deleted swapped, renames reversed. A revert undoes
   * its original exactly when its `shape` equals the original's `mirror`.
   */
  readonly mirror: number;
  /**
   * The diff could be whitespace-only: something changed, every change
   * modifies a file with as many lines added as deleted (a diff that
   * `git diff -w` empties pairs each changed line with its old version), and
   * no file belongs to a language where indentation is syntax, since moving a
   * line there changes what the code does. Only a necessary condition:
   * `git log -w` decides.
   */
  readonly maybeWhitespace: boolean;
  /**
   * A hash of the paths, renames, and line counts of the changes: equal
   * patches have equal fingerprints, equal fingerprints say nothing more.
   */
  readonly fingerprint: number;
};

type Change = Commit["changes"][number];

const NO_PATHS: ReadonlySet<string> = new Set();

const keyOf = (from: string, path: string, added: number, deleted: number) =>
  `${from}\0${path}\0${added}\0${deleted}`;

const hashAll = (keys: ReadonlyArray<string>): number =>
  hashText(keys.toSorted().join("\n"));

const fingerprintOf = (changes: ReadonlyArray<Change>): number =>
  hashAll(
    changes.map(({ path, renamedFrom, added, deleted }) =>
      keyOf(renamedFrom ?? "", path, added, deleted),
    ),
  );

const mirrorOf = (changes: ReadonlyArray<Change>): number =>
  hashAll(
    changes.map(({ path, renamedFrom, added, deleted }) =>
      keyOf(
        renamedFrom === undefined ? "" : path,
        renamedFrom ?? path,
        deleted,
        added,
      ),
    ),
  );

const mightBeWhitespace = (changes: Commit["changes"]): boolean =>
  changes.some(({ added, deleted }) => added + deleted > 0) &&
  changes.every(
    ({ added, deleted, created, removed, path, renamedFrom }) =>
      created === undefined &&
      removed === undefined &&
      added === deleted &&
      !isIndentationSignificant(path) &&
      !isIndentationSignificant(renamedFrom ?? path),
  );

const fileChangeOf = ({
  path,
  renamedFrom,
  blobs,
  typeChanged,
}: Change): FileChange => ({
  from: renamedFrom ?? path,
  to: path,
  blobs,
  typeChanged: typeChanged === true,
});

/**
 * The signals of a commit as the whole log shows it; `analyzed` are its
 * changes at universe paths, and `keepFileChanges` says whether a pair needs
 * to look at them.
 */
export const signalsOf = (
  commit: Commit,
  analyzed: ReadonlyArray<Change>,
  keepFileChanges: boolean,
): CommitSignals => ({
  sha: commit.sha,
  time: commit.time,
  moveOnly: commit.moveOnly,
  reverts: commit.reverts,
  touchedPaths:
    commit.reverts === undefined
      ? NO_PATHS
      : new Set(
          analyzed.flatMap(({ path, renamedFrom }) =>
            renamedFrom === undefined ? [path] : [path, renamedFrom],
          ),
        ),
  fileChanges: keepFileChanges
    ? analyzed.map((change) => fileChangeOf(change))
    : undefined,
  shape: fingerprintOf(analyzed),
  mirror: mirrorOf(analyzed),
  maybeWhitespace: mightBeWhitespace(commit.changes),
  fingerprint: fingerprintOf(commit.changes),
});
