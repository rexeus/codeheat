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
   * touched the file, test code included; a file no counted change touched
   * has none.
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

/**
 * Groups the real commits `real` of a window into logical changes (see
 * `groupChanges`, which `merges` informs) and takes test code (`isTest` by
 * file id) out of each: a change holds and is sized by the other files only,
 * and a change of nothing but test code is none. A test file still counts the
 * changes its commits belong to.
 */
export const measureChanges = (
  real: ReadonlyArray<Entry>,
  isTest: ReadonlyArray<boolean>,
  merges: ReadonlyMap<string, string>,
): MeasuredChanges => {
  const grouping = groupChanges(
    real.map((entry) => candidateOf(entry, isTest)),
    merges,
  );
  const changesOf = new Map<number, number>();
  for (const [index, change] of grouping.changes.entries()) {
    const members = isCounted(change) ? (grouping.members[index] ?? []) : [];
    const touched = new Set(
      members.flatMap((member) => Array.from(real[member]?.files ?? [])),
    );
    for (const id of touched) {
      changesOf.set(id, (changesOf.get(id) ?? 0) + 1);
    }
  }
  const kept = grouping.changes.flatMap((change, index) =>
    change.size > 0
      ? [{ change, commits: grouping.members[index]?.length ?? 0 }]
      : [],
  );
  return {
    changes: kept.map(({ change }) => change),
    logicalChanges: {
      by: grouping.by,
      count: kept.length,
      largest: kept.reduce((most, { commits }) => Math.max(most, commits), 0),
    },
    changesOf,
  };
};
