// Owns the start of measurement: turning the real commits of a window into the
// changes every design measure counts. The commits hold universe files only,
// so what the exclude patterns leave out is in no change and sizes none.
import { groupChanges } from "../changes/group.js";
import type { GroupedBy } from "../changes/group.js";
import type { LogicalChange } from "../changes/logical-change.js";
import { countedChanges } from "../coupling/coupling.js";
import type { Entry } from "./scan.js";

/** The changes of a window and how many of them touched each file. */
export type MeasuredChanges = {
  /** The changes (see `History.changes`). */
  readonly changes: ReadonlyArray<LogicalChange>;
  readonly logicalChanges: {
    readonly by: GroupedBy;
    /** The number of `changes`. */
    readonly count: number;
    /** The most commits one change holds. */
    readonly largest: number;
  };
  /**
   * Per file id, the counted changes (see `countedChanges`) that touched the
   * file. A file no counted change touched has none.
   */
  readonly changesOf: ReadonlyMap<number, number>;
};

/**
 * Groups the real commits `real` of a window into logical changes (see
 * `groupChanges`, which `merges` informs), each sized by the universe files
 * its commits touched, earlier lives included, and credits every counted
 * change to the files it touched.
 */
export const measureChanges = (
  real: ReadonlyArray<Entry>,
  merges: ReadonlyMap<string, string>,
): MeasuredChanges => {
  const grouping = groupChanges(
    real.map(({ signals, subject, files, previousLives, size }) => ({
      sha: signals.sha,
      time: signals.time,
      subject,
      files,
      previousLives,
      size,
    })),
    merges,
  );
  const changesOf = new Map<number, number>();
  for (const change of countedChanges(grouping.changes)) {
    for (const id of change.files) {
      changesOf.set(id, (changesOf.get(id) ?? 0) + 1);
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
