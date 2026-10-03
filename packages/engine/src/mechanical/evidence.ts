// Owns asking git what the commits' own shape cannot tell: ignored revisions,
// whitespace-only diffs, patch ids, the content of reverts. Each question is put only for the commits
// that could have the answer, because every one of them costs a diff.
import { Effect } from "effect";

import type { GitError } from "../git/git-errors.js";
import type { Git } from "../git/git.js";
import type { Evidence } from "./classify.js";
import { findDuplicates } from "./duplicates.js";
import { readIgnoredRevisions } from "./ignore-revisions.js";
import { readPatchIds } from "./patch-id.js";
import { readReLands } from "./re-lands.js";
import { readConfirmedReverts } from "./reverts.js";
import type { RevertCandidate } from "./reverts.js";
import type { CommitSignals } from "./signals.js";
import { readWhitespaceOnly } from "./whitespace.js";

/** The commits that share their fingerprint with another: the only ones with a duplicate. */
const sharingFingerprint = (
  commits: ReadonlyArray<CommitSignals>,
): ReadonlyArray<string> => {
  const byFingerprint = new Map<number, Array<string>>();
  for (const { fingerprint, sha } of commits) {
    const group = byFingerprint.get(fingerprint) ?? [];
    group.push(sha);
    byFingerprint.set(fingerprint, group);
  }
  return [...byFingerprint.values()].filter((shas) => shas.length > 1).flat();
};

/**
 * The reverts whose line counts mirror the commit they name: the only ones
 * worth comparing patches for, since an undo has mirrored counts.
 */
const mirroredReverts = (
  commits: ReadonlyArray<CommitSignals>,
): ReadonlyArray<RevertCandidate> => {
  const bySha = new Map(commits.map((commit) => [commit.sha, commit]));
  return commits.flatMap((revert) => {
    const original =
      revert.reverts === undefined ? undefined : bySha.get(revert.reverts);
    return original !== undefined && revert.shape === original.mirror
      ? [{ revert, original }]
      : [];
  });
};

/**
 * Reads the evidence for `commits`, every commit of the log that touched the
 * universe. Needs a `HEAD`.
 */
export const readEvidence = (
  commits: ReadonlyArray<CommitSignals>,
): Effect.Effect<Evidence, GitError, Git> =>
  Effect.gen(function* () {
    const ignored = yield* readIgnoredRevisions;
    const undecided = commits.filter(
      ({ sha, moveOnly }) => !ignored.has(sha) && !moveOnly,
    );
    const whitespaceOnly = yield* readWhitespaceOnly(
      undecided
        .filter((commit) => commit.maybeWhitespace)
        .map(({ sha }) => sha),
    );
    const open = undecided.filter(({ sha }) => !whitespaceOnly.has(sha));
    const patchIds = yield* readPatchIds(sharingFingerprint(open));
    const reLands = yield* readReLands(findDuplicates(open, patchIds));
    const confirmedReverts = yield* readConfirmedReverts(mirroredReverts(open));
    return { ignored, whitespaceOnly, patchIds, reLands, confirmedReverts };
  });

/**
 * The evidence for the commits of one span, from the evidence for a longer
 * read that contains it. What git says about a commit alone, and about a
 * revert and the commit it names, does not depend on the span. A re-land
 * does: a copy sits on top of an older copy of its patch, and the older copies
 * of a span are those inside it, so the re-lands are found again among the
 * duplicates of `commits` (newest first). That is what reading the span on
 * its own would have found.
 */
export const evidenceWithin = (
  evidence: Evidence,
  commits: ReadonlyArray<CommitSignals>,
): Effect.Effect<Evidence, GitError, Git> =>
  Effect.gen(function* () {
    const open = commits.filter(
      ({ sha, moveOnly }) =>
        !evidence.ignored.has(sha) &&
        !moveOnly &&
        !evidence.whitespaceOnly.has(sha),
    );
    const reLands = yield* readReLands(findDuplicates(open, evidence.patchIds));
    return { ...evidence, reLands };
  });
