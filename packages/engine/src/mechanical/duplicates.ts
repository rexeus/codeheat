// Owns finding commits that carry the same patch as an older commit.
import type { CommitSignals } from "./signals.js";

/** A commit and the older commits with its patch id. */
export type Duplicate = {
  /** The oldest commit with the patch id. */
  readonly original: CommitSignals;
  readonly copy: CommitSignals;
  /** Every older commit with the patch id, oldest first; starts with `original`. */
  readonly older: ReadonlyArray<CommitSignals>;
};

/**
 * Every commit among `commits` (newest first) whose patch id equals that of an
 * older one, with the oldest commit of that id; of commits with equal times
 * the one later in the list counts as the older.
 */
export const findDuplicates = (
  commits: ReadonlyArray<CommitSignals>,
  patchIds: ReadonlyMap<string, string>,
): ReadonlyArray<Duplicate> => {
  const oldestFirst = commits.toReversed().toSorted((a, b) => a.time - b.time);
  const seen = new Map<string, Array<CommitSignals>>();
  const duplicates: Array<Duplicate> = [];
  for (const commit of oldestFirst) {
    const id = patchIds.get(commit.sha);
    if (id === undefined) {
      continue;
    }
    const older = seen.get(id) ?? [];
    const [original] = older;
    if (original !== undefined) {
      duplicates.push({ original, copy: commit, older: [...older] });
    }
    seen.set(id, [...older, commit]);
  }
  return duplicates;
};
