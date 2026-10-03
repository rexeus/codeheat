// Owns deciding which commits of a window are mechanical, and why.
import { findDuplicates } from "./duplicates.js";
import type { MechanicalKind } from "./kinds.js";
import type { CommitSignals } from "./signals.js";

/** What git said about the commits beyond their own shape. */
export type Evidence = {
  /** Commits `.git-blame-ignore-revs` lists. */
  readonly ignored: ReadonlySet<string>;
  /** Commits whose diff is empty under `git log -w`. */
  readonly whitespaceOnly: ReadonlySet<string>;
  /** Patch ids by sha, for the commits that could have a duplicate. */
  readonly patchIds: ReadonlyMap<string, string>;
  /** Reverts whose patch over the analyzed files is the reverse of the patch of the commit they name. */
  readonly confirmedReverts: ReadonlySet<string>;
  /** Commits that apply a patch again on top of the older commit that had it: a re-land, not a copy. */
  readonly reLands: ReadonlySet<string>;
};

type Kinds = Map<string, MechanicalKind>;

/**
 * A revert and the commit it reverts neutralize each other, but only when
 * both are in the window, neither is mechanical for another reason, and the
 * revert is confirmed to undo the original (`Evidence.confirmedReverts`). A
 * revert of a commit outside the window changes the code inside it, and a
 * message that names a commit does not make a squash commit with other work,
 * a revert of part of the commit, or a rewrite of what it reverted, a clean
 * undo. A revert that was itself reverted pairs with its reverter, which
 * leaves the first commit as the one real change.
 */
const pairReverts = (
  window: ReadonlyArray<CommitSignals>,
  evidence: Evidence,
  kinds: Kinds,
): void => {
  const bySha = new Map(window.map((commit) => [commit.sha, commit]));
  for (const revert of window) {
    const original =
      revert.reverts === undefined ? undefined : bySha.get(revert.reverts);
    if (
      original !== undefined &&
      evidence.confirmedReverts.has(revert.sha) &&
      !kinds.has(revert.sha) &&
      !kinds.has(original.sha)
    ) {
      kinds.set(revert.sha, "reverts");
      kinds.set(original.sha, "reverts");
    }
  }
};

/**
 * Every commit with the patch id of an older commit is a copy of it, unless
 * it sits on top of that commit: applying a patch again after it was backed
 * out changes the code once more. The oldest of each id is the change.
 */
const markDuplicates = (
  window: ReadonlyArray<CommitSignals>,
  { patchIds, reLands }: Evidence,
  kinds: Kinds,
): void => {
  const open = window.filter(({ sha }) => !kinds.has(sha));
  for (const { copy } of findDuplicates(open, patchIds)) {
    if (!reLands.has(copy.sha)) {
      kinds.set(copy.sha, "duplicates");
    }
  }
};

const ownKind = (
  commit: CommitSignals,
  { ignored, whitespaceOnly }: Evidence,
): MechanicalKind | undefined => {
  if (ignored.has(commit.sha)) {
    return "ignored";
  }
  if (commit.moveOnly) {
    return "renames";
  }
  return whitespaceOnly.has(commit.sha) ? "whitespace" : undefined;
};

/**
 * The kind of every mechanical commit among `window`, which holds the commits
 * of one analysis window, newest first. Pairs of reverts and duplicates
 * are looked for inside the window only: a window is judged by what it
 * contains.
 */
export const classify = (
  window: ReadonlyArray<CommitSignals>,
  evidence: Evidence,
): ReadonlyMap<string, MechanicalKind> => {
  const kinds: Kinds = new Map();
  for (const commit of window) {
    const kind = ownKind(commit, evidence);
    if (kind !== undefined) {
      kinds.set(commit.sha, kind);
    }
  }
  pairReverts(window, evidence, kinds);
  markDuplicates(window, evidence, kinds);
  return kinds;
};
