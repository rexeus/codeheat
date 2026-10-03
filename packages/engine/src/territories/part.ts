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

/** A part and, when it splits at some detail, its children. */
export type TreeNode = {
  readonly part: Part;
  /** Why it splits; undefined for a part that does not. */
  readonly reason: string | undefined;
  readonly children: ReadonlyArray<TreeNode>;
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
  /** Per file that shapes the tree, its heat (`changes × (loc + complexity)`) and that of the test code paired with it. */
  readonly heat: ReadonlyMap<string, number>;
  /**
   * The heat of the test code placed in a directory (see `attachTests`), by
   * that directory. It ends up in the territory of the code below the
   * directory, so a folder counts it only when the directory is at or below it.
   */
  readonly placed: ReadonlyMap<string, number>;
  /** The heat of every code file, test code that is paired with none included. */
  readonly totalHeat: number;
};

/** The directory `home` is `directory` or lies below it; every directory contains the root (""). */
const isWithin = (home: string, directory: string): boolean =>
  directory === "" || home === directory || home.startsWith(`${directory}/`);

/**
 * The heat of a part that holds `files` and was cut from `directories`: that of
 * the files and of the test code paired with them, and that of the test code
 * placed in a directory at or below one of `directories`. Test code placed in
 * a directory above them lands in a territory that holds more than the part,
 * so it heats none of its parts.
 */
export const heatOf = (
  evidence: Evidence,
  files: ReadonlyArray<string>,
  directories: ReadonlyArray<string>,
): number =>
  files.reduce((sum, file) => sum + (evidence.heat.get(file) ?? 0), 0) +
  [...evidence.placed]
    .filter(([home]) => directories.some((at) => isWithin(home, at)))
    .reduce((sum, [, heat]) => sum + heat, 0);

/** The directories a part was cut from: those of its members, else its own; none for loose files. */
export const directoriesOf = (part: Part): ReadonlyArray<string> => {
  if (part.members.length > 0) {
    return part.members.map(({ path }) => path);
  }
  return part.kind === "other" ? [] : [part.path];
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
