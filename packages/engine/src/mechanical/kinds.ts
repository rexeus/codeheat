// Owns the vocabulary of mechanical commits: commits that change a repository
// without changing what its code does, so they say nothing about where the
// design is under pressure.

/**
 * Why a commit is mechanical. A commit has at most one kind; when several
 * apply, the first of this list wins.
 */
export type MechanicalKind =
  | "ignored"
  | "renames"
  | "whitespace"
  | "reverts"
  | "duplicates";

/** How many commits of a window are mechanical, per kind. */
export type MechanicalCounts = Readonly<Record<MechanicalKind, number>>;

/** Counts `kinds` per kind; every kind is present, 0 when absent. */
export const countKinds = (
  kinds: Iterable<MechanicalKind>,
): MechanicalCounts => {
  const counts = {
    ignored: 0,
    renames: 0,
    whitespace: 0,
    reverts: 0,
    duplicates: 0,
  };
  for (const kind of kinds) {
    counts[kind] += 1;
  }
  return counts;
};
