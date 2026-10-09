// Owns the start of measurement: turning the real commits of a window into the
// changes every design measure counts, with test code left out of each.
import { groupChanges } from "../changes/group.js";
import type { Candidate, GroupedBy } from "../changes/group.js";
import type { LogicalChange } from "../changes/logical-change.js";
import { isCounted } from "../coupling/coupling.js";
import type { Entry } from "./scan.js";

/** The changes of a window and how many of them touched each file. */
export type MeasuredChanges = {
  /** The changes that touched code other than tests (see `History.changes`). */
  readonly changes: ReadonlyArray<LogicalChange>;
  readonly logicalChanges: {
    readonly by: GroupedBy;
    /** The number of `changes`. */
    readonly count: number;
    /** The most commits one change holds. */
    readonly largest: number;
  };
  /**
   * Per file id, the counted changes (see `countedChanges`) whose commits
   * touched the file; a commit of test code alone counts as a change of its
   * own for the test files it touched. A file no counted change touched has
   * none.
   */
  readonly changesOf: ReadonlyMap<number, number>;
};

/**
 * A real commit as the measures see it: without its test code (`isTest` by
 * file id), sized by the files that remain, dead ones included.
 */
const candidateOf = (
  { signals, subject, files, previousLives }: Entry,
  isTest: ReadonlyArray<boolean>,
): Candidate => {
  const live = files.filter((id) => isTest[id] !== true);
  const dead = previousLives.filter((id) => isTest[id] !== true);
  return {
    sha: signals.sha,
    time: signals.time,
    subject,
    files: live,
    previousLives: dead,
    size: live.length + dead.length,
  };
};

/** Adds one change to each of the files `ids` names, each counted once. */
const credit = (
  changesOf: Map<number, number>,
  ids: Iterable<number>,
): void => {
  for (const id of new Set(ids)) {
    changesOf.set(id, (changesOf.get(id) ?? 0) + 1);
  }
};

/**
 * Takes test code (`isTest` by file id) out of the real commits `real` of a
 * window and groups the commits that touched other code into logical changes
 * (see `groupChanges`, which `merges` informs): a change holds and is sized by
 * the files that are no test code, and a commit of test code alone is part of
 * no change, so it neither joins nor splits one. A test file still counts the
 * changes its commits belong to, and a commit of test code alone as one.
 */
export const measureChanges = (
  real: ReadonlyArray<Entry>,
  isTest: ReadonlyArray<boolean>,
  merges: ReadonlyMap<string, string>,
): MeasuredChanges => {
  const read = real.map((entry) => ({
    entry,
    candidate: candidateOf(entry, isTest),
  }));
  const code = read.filter(({ candidate }) => candidate.size > 0);
  const grouping = groupChanges(
    code.map(({ candidate }) => candidate),
    merges,
  );
  const changesOf = new Map<number, number>();
  for (const [index, change] of grouping.changes.entries()) {
    const members = isCounted(change) ? (grouping.members[index] ?? []) : [];
    credit(
      changesOf,
      members.flatMap((member) => Array.from(code[member]?.entry.files ?? [])),
    );
  }
  for (const { entry, candidate } of read) {
    if (candidate.size === 0) {
      credit(changesOf, entry.files);
    }
  }
  return {
    changes: grouping.changes,
    logicalChanges: {
      by: grouping.by,
      count: grouping.changes.length,
      largest: grouping.largest,
    },
    changesOf,
  };
};
