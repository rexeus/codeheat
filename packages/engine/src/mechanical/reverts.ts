// Owns confirming that a revert undoes its original: the same line counts
// mirrored are only a prefilter, because a commit that replaces a one-line fix
// with another one-line fix has them too.
//
// A file is undone when the revert gave it back the object it had before the
// original (the object ids of the raw entries the scan already read); a file
// that was edited elsewhere in between is undone when the revert's patch for it
// is the original's patch reversed, which needs `git log -p`. A pair is
// confirmed when every analyzed file of both commits is undone, one way or the
// other; anything git cannot show exactly leaves it unconfirmed.
import { Effect, Stream } from "effect";

import type { GitError } from "../git/git-errors.js";
import { Git } from "../git/git.js";
import { PatchDigester } from "./patch-digest.js";
import type { CommitDigests } from "./patch-digest.js";
import type { CommitSignals, FileChange } from "./signals.js";

/** A revert and the commit its message names, whose line counts mirror it. */
export type RevertCandidate = {
  readonly revert: CommitSignals;
  readonly original: CommitSignals;
};

/** Commits per `git log -p`, so one batch of patches stays small in memory. */
const BATCH_SIZE = 64;

/**
 * Options that make `git log -p` print the same patch whatever the user's
 * configuration says about color, prefixes, renames, external diff tools, and
 * text conversion.
 */
const PATCH_ARGS = [
  "--no-merges",
  "-p",
  "--no-renames",
  "--full-index",
  "--no-color",
  "--src-prefix=a/",
  "--dst-prefix=b/",
  "--no-ext-diff",
  "--no-textconv",
  "--no-show-signature",
  "--format=commit %H",
] as const;

const batchesOf = (
  shas: ReadonlyArray<string>,
): ReadonlyArray<ReadonlyArray<string>> =>
  Array.from({ length: Math.ceil(shas.length / BATCH_SIZE) }, (_, index) =>
    shas.slice(index * BATCH_SIZE, (index + 1) * BATCH_SIZE),
  );

const readDigests = (
  shas: ReadonlyArray<string>,
  paths: ReadonlySet<string>,
): Effect.Effect<ReadonlyMap<string, CommitDigests>, GitError, Git> =>
  Effect.gen(function* () {
    const git = yield* Git;
    const digester = new PatchDigester(paths);
    for (const batch of batchesOf(shas)) {
      yield* git
        .stream(
          [
            "-c",
            "core.quotePath=false",
            "log",
            "--no-walk=unsorted",
            "--stdin",
            ...PATCH_ARGS,
          ],
          `${batch.join("\n")}\n`,
        )
        .pipe(
          Stream.runForEach((chunk) =>
            Effect.sync(() => {
              digester.push(chunk);
            }),
          ),
        );
    }
    return digester.end();
  });

const renameKey = ({ from, to }: FileChange): string => `${from}\0${to}`;

/** Whether the revert's change gave the file back the object the original took away. */
const restoresFile = (revert: FileChange, original: FileChange): boolean =>
  !revert.typeChanged &&
  !original.typeChanged &&
  revert.blobs !== undefined &&
  original.blobs !== undefined &&
  revert.blobs.old === original.blobs.new &&
  revert.blobs.new === original.blobs.old;

/**
 * What a pair needs: `possible` false when it is ruled out, otherwise the paths
 * whose files the object ids do not show restored (none when they all are),
 * which the patches still have to confirm.
 */
type Need =
  | { readonly possible: false }
  | { readonly possible: true; readonly paths: ReadonlySet<string> };

const needOf = ({ revert, original }: RevertCandidate): Need => {
  if (revert.fileChanges === undefined || original.fileChanges === undefined) {
    return { possible: true, paths: revert.touchedPaths };
  }
  if (revert.fileChanges.length !== original.fileChanges.length) {
    return { possible: false };
  }
  const originals = new Map(
    original.fileChanges.map((change) => [renameKey(change), change]),
  );
  const unrestored = new Set<string>();
  for (const change of revert.fileChanges) {
    const undone = originals.get(`${change.to}\0${change.from}`);
    if (undone === undefined || change.typeChanged || undone.typeChanged) {
      return { possible: false };
    }
    if (!restoresFile(change, undone)) {
      unrestored.add(change.from);
      unrestored.add(change.to);
    }
  }
  return { possible: true, paths: unrestored };
};

/** Whether the revert's patch for every path is the original's patch reversed. */
const undoes = (
  { revert, original }: RevertCandidate,
  paths: ReadonlySet<string>,
  digests: ReadonlyMap<string, CommitDigests>,
): boolean => {
  const changed = digests.get(revert.sha);
  const undone = digests.get(original.sha);
  return [...paths].every((path) => {
    const now = changed?.get(path);
    const before = undone?.get(path);
    return (
      now?.comparable === true &&
      before?.comparable === true &&
      now.forward === before.reverse
    );
  });
};

/**
 * The reverts among `candidates` that undo the commit they name over the
 * analyzed files: by object ids where the files were restored exactly, by
 * comparing patches where they were edited in between.
 */
export const readConfirmedReverts = (
  candidates: ReadonlyArray<RevertCandidate>,
): Effect.Effect<ReadonlySet<string>, GitError, Git> =>
  Effect.gen(function* () {
    const needs = candidates.map((candidate) => ({
      candidate,
      need: needOf(candidate),
    }));
    const pending = needs.filter(
      (entry) => entry.need.possible && entry.need.paths.size > 0,
    );
    const confirmed = new Set(
      needs
        .filter((entry) => entry.need.possible && entry.need.paths.size === 0)
        .map(({ candidate }) => candidate.revert.sha),
    );
    if (pending.length === 0) {
      return confirmed;
    }
    const digests = yield* readDigests(
      [
        ...new Set(
          pending.flatMap(({ candidate }) => [
            candidate.revert.sha,
            candidate.original.sha,
          ]),
        ),
      ],
      new Set(
        pending.flatMap(({ need }) => (need.possible ? [...need.paths] : [])),
      ),
    );
    for (const { candidate, need } of pending) {
      if (need.possible && undoes(candidate, need.paths, digests)) {
        confirmed.add(candidate.revert.sha);
      }
    }
    return confirmed;
  });
