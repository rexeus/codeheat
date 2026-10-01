// Owns which changes belong to the file that exists today. The walk over the
// log goes from the newest commit to the oldest and learns, as it goes, which
// names were renamed and which files died: a change to a file that was deleted
// at a path that exists again belongs to nobody.
import type { Commit } from "./parse-log.js";

/** Lines a commit added and deleted in one file. */
type Lines = { readonly added: number; readonly deleted: number };

const addLines = (total: Lines | undefined, more: Lines): Lines => ({
  added: (total?.added ?? 0) + more.added,
  deleted: (total?.deleted ?? 0) + more.deleted,
});

/** How a name came to a file in a commit newer than the one being read. */
type Birth = {
  /** The object id of the content the file started with; unknown for a rename. */
  readonly blob: string | undefined;
  /** Whether the file is dead: deleted later, with the name given to another file afterwards. */
  readonly ofDeadFile: boolean;
};

/** What the walk from the newest commit has learned about names. */
export type Lineage = {
  /** Old path to the path its file has today. */
  readonly renamedTo: Map<string, string>;
  /**
   * Names a file was given in a newer commit and no deletion has used up yet.
   * Only a deletion of such a name ends a life: without a newer file by that
   * name, the path is deleted for good (and not in the universe) or the
   * deletion was undone by a merge, which `--no-merges` hides.
   */
  readonly created: Map<string, Birth>;
  /**
   * Names a deleted file had in the commits older than its deletion, until the
   * walk reaches the commit that gave the file that name, or one that shows
   * another file at the name before. They are names as each commit wrote them,
   * not current paths: a file renamed onto the path of a deleted one is a
   * different file.
   */
  readonly deadNames: Set<string>;
};

/** A walk that has not read a commit yet. */
export const newLineage = (): Lineage => ({
  renamedTo: new Map(),
  created: new Map(),
  deadNames: new Set(),
});

/** What one commit changed in the universe. */
export type Touch = {
  /** Lines changed per file id, in the current file's life only. */
  readonly lines: ReadonlyMap<number, Lines>;
  /** How many distinct universe files the commit changed, dead ones included. */
  readonly size: number;
};

type Change = Commit["changes"][number];

/** What a change says about the life of its file, and which names it gives, takes and frees. */
type Life = {
  readonly isPreviousLife: boolean;
  readonly gives: ReadonlyArray<readonly [string, Birth]>;
  readonly takes: ReadonlyArray<string>;
  readonly frees: ReadonlyArray<string>;
};

/** Object ids of empty content (SHA-1, SHA-256): two unrelated empty files are not the same file. */
const EMPTY_BLOBS: ReadonlySet<string> = new Set([
  "e69de29bb2d1d6434b8b29ae775ad8c2e48c5391",
  "473a0f4c3be8a93681a267e3b1e9a7dcda1185436fe141f7749120a303721813",
]);

/** Whether the change deletes a file for good, and whether the file it touches is dead. */
const fateOf = (change: Change, lineage: Lineage) => {
  const newer =
    change.removed === true ? lineage.created.get(change.path) : undefined;
  const isDead = lineage.deadNames.has(change.path);
  if (newer === undefined) {
    return { dies: false, isPreviousLife: isDead };
  }
  // A deleted file that comes back with the very content it had is the same file.
  const restores =
    newer.blob !== undefined &&
    newer.blob === change.blob &&
    !EMPTY_BLOBS.has(newer.blob);
  const dies = !restores || newer.ofDeadFile;
  return { dies, isPreviousLife: dies || isDead };
};

const lifeOf = (change: Change, lineage: Lineage): Life => {
  const { dies, isPreviousLife } = fateOf(change, lineage);
  const { renamedFrom } = change;
  const birth: Birth = {
    blob: change.created === true ? change.blob : undefined,
    ofDeadFile: isPreviousLife,
  };
  const born = change.created === true || renamedFrom !== undefined;
  // A rename away from a dead name shows another file there before.
  const frees =
    renamedFrom !== undefined &&
    !isPreviousLife &&
    lineage.deadNames.has(renamedFrom);
  return {
    isPreviousLife,
    gives: born ? [[change.path, birth]] : [],
    takes: [
      ...(dies ? [change.path] : []),
      ...(isPreviousLife && renamedFrom !== undefined ? [renamedFrom] : []),
    ],
    frees: frees ? [renamedFrom] : [],
  };
};

/**
 * What the commit changed in the universe, given the commits newer than it.
 * Records the commit's renames, creations and deletions in `lineage`.
 *
 * A deletion of a name that a newer commit gave to a file ends the life of the
 * file that had the name; its change and every older change to that file
 * belong to a previous life and add no lines, up to the commit that created
 * it. A deletion without such a newer file ends nothing: the path is gone for
 * good, or a merge undid the deletion. Neither does one that a newer addition
 * with the same content undoes: that file came back. A file renamed onto a
 * name of a dead file is that dead file, so its old name ends with it. A
 * rename's old name is otherwise not a deletion, and deleting and re-adding a
 * path in one commit is an edit, as the commit's diff shows it.
 */
export const touchUniverse = (
  commit: Commit,
  lineage: Lineage,
  fileIds: ReadonlyMap<string, number>,
): Touch => {
  const lines = new Map<number, Lines>();
  const touched = new Set<number>();
  const lives: Array<Life> = [];
  for (const change of commit.changes) {
    const path = lineage.renamedTo.get(change.path) ?? change.path;
    const life = lifeOf(change, lineage);
    lives.push(life);
    if (change.renamedFrom !== undefined) {
      lineage.renamedTo.set(change.renamedFrom, path);
    }
    const id = fileIds.get(path);
    if (id !== undefined) {
      touched.add(id);
      if (!life.isPreviousLife) {
        lines.set(id, addLines(lines.get(id), change));
      }
    }
  }
  for (const { frees, gives, takes } of lives) {
    for (const name of frees) {
      lineage.deadNames.delete(name);
    }
    for (const [name, birth] of gives) {
      lineage.deadNames.delete(name);
      lineage.created.set(name, birth);
    }
    for (const name of takes) {
      lineage.created.delete(name);
      lineage.deadNames.add(name);
    }
  }
  return { lines, size: touched.size };
};
