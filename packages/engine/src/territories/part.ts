// Owns the shapes a territory tree is grown from: a part of the code that may
// split, and the evidence about how the code changes that decides whether it does.

/**
 * What a part is: a `folder` (the files below one directory), a `group` of
 * sibling folders that change together, a `more` bucket of smaller sibling
 * folders that wait for a finer detail, `other` loose files with no folder
 * of their own, or `tests` (a folder of test code that belongs to no code).
 */
type PartKind = "folder" | "group" | "more" | "other" | "tests";

export type Part = {
  readonly kind: PartKind;
  /** The directory of a folder or of loose files, "" for the repository root; the member directories joined by " + " for a group. */
  readonly path: string;
  /** The files that shape the tree: code files, and test code that belongs to no code. */
  readonly files: ReadonlyArray<string>;
  /** The folders a group or a bucket is made of. */
  readonly members: ReadonlyArray<Part>;
  /** The directory a group or bucket sits in. */
  readonly base: string;
  /** Loose files of a bucket: files of its directory that have no folder of their own. */
  readonly rest: ReadonlyArray<string>;
};

/** A part with more than this share of the universe's files is too big to stay one territory. */
export const TOO_BIG_SHARE = 0.4;

/** What the counted changes say, indexed so that a part finds the changes that touch it. */
export type Evidence = {
  /** Files that shape the tree. */
  readonly total: number;
  /** Changes that touched at least one of them. */
  readonly changeCount: number;
  /** Per file, the indices into `changes` that touched it. */
  readonly byFile: ReadonlyMap<string, ReadonlyArray<number>>;
  /** The files each change touched, restricted to the files that shape the tree. */
  readonly changes: ReadonlyArray<ReadonlyArray<string>>;
  /** Fewest changes at which a part's changes say something (see `Thresholds.minModuleCommits`). */
  readonly minChanges: number;
  /** Files above which a part is too big to stay one territory, if it changes enough. */
  readonly sizeBound: number;
};

/** The indices of the changes that touched any of `files`. */
export const changesTouching = (
  evidence: Evidence,
  files: ReadonlyArray<string>,
): ReadonlySet<number> => {
  const touching = new Set<number>();
  for (const file of files) {
    for (const index of evidence.byFile.get(file) ?? []) {
      touching.add(index);
    }
  }
  return touching;
};
