// Owns the shapes a territory tree is grown from: a part of the code that may
// split, and the evidence about how the code changes that decides whether it does.

/**
 * What a part is: a `folder` (the files below one directory), a `group` of
 * sibling folders that change together, a `more` bucket of smaller sibling
 * folders that wait for a finer detail, or the loose `files` of a directory,
 * which have no folder of their own.
 */
type PartKind = "folder" | "group" | "more" | "files";

export type Part = {
  readonly kind: PartKind;
  /** The directory of a folder or of loose files, "" for the repository root; the brace glob of the member directories for a group (see `groupPath`). */
  readonly path: string;
  /**
   * The directory a folder was cut out as, before `path` was cut down to
   * where its files branch (the key of its cut, "" for the root). A group, a
   * bucket, and loose files have none.
   */
  readonly cut?: string;
  /** The files that shape the tree: the code files, test code left out. */
  readonly files: ReadonlyArray<string>;
  /** The folders a group or a bucket is made of. */
  readonly members: ReadonlyArray<Part>;
  /** The directory a group or bucket sits in. */
  readonly base: string;
};

/** A part and, when it splits at some detail, its children. */
export type TreeNode = {
  readonly part: Part;
  /** Why it splits; undefined for a part that does not. */
  readonly reason: string | undefined;
  readonly children: ReadonlyArray<TreeNode>;
};

/**
 * Policy: a share of all heat below which a folder is noise. A folder with
 * fewer than `MIN_CHILD` files that holds at least this share is a part of its
 * own, and a bucket hides a folder only when the folder holds at least this
 * share.
 */
export const MIN_VISIBLE_HEAT = 0.01;

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
  /** Per file that shapes the tree, its heat (`changes × (loc + complexity)`). */
  readonly heat: ReadonlyMap<string, number>;
  /** The heat of every file that shapes the tree. */
  readonly totalHeat: number;
};

/** The heat of a part that holds `files`. */
export const heatOf = (
  evidence: Evidence,
  files: ReadonlyArray<string>,
): number =>
  files.reduce((sum, file) => sum + (evidence.heat.get(file) ?? 0), 0);

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

/** Whether a folder with `files` holds at least `MIN_VISIBLE_HEAT` of all heat. */
export const isHotFolder = (
  evidence: Evidence,
  files: ReadonlyArray<string>,
): boolean =>
  evidence.totalHeat > 0 &&
  heatOf(evidence, files) / evidence.totalHeat >= MIN_VISIBLE_HEAT;
