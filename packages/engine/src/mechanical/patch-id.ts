// Owns reading patch ids: the hash `git patch-id --stable` gives a patch, equal
// for the same change applied twice (a cherry-pick, a backport).
import { Effect } from "effect";

import type { GitError } from "../git/git-errors.js";
import { Git } from "../git/git.js";

/** Commits per `git log -p`, so one batch of patches stays small in memory. */
const BATCH_SIZE = 64;

const batchesOf = (
  shas: ReadonlyArray<string>,
): ReadonlyArray<ReadonlyArray<string>> =>
  Array.from({ length: Math.ceil(shas.length / BATCH_SIZE) }, (_, index) =>
    shas.slice(index * BATCH_SIZE, (index + 1) * BATCH_SIZE),
  );

/**
 * The patch id of each of `shas`, by sha; a commit without a diff has none.
 * Patches are read with the same options for every commit, so a user's diff
 * configuration shifts all ids alike and equality survives it.
 */
export const readPatchIds = (
  shas: ReadonlyArray<string>,
): Effect.Effect<ReadonlyMap<string, string>, GitError, Git> =>
  Effect.gen(function* () {
    const git = yield* Git;
    const ids = new Map<string, string>();
    for (const batch of batchesOf(shas)) {
      const patches = yield* git.text(
        [
          "log",
          "--no-walk=unsorted",
          "--stdin",
          "--no-merges",
          "-p",
          "-M",
          "--no-ext-diff",
          "--no-textconv",
          "--no-show-signature",
          "--format=commit %H",
        ],
        `${batch.join("\n")}\n`,
      );
      const output = yield* git.text(["patch-id", "--stable"], patches);
      for (const line of output.split("\n")) {
        const [id, sha] = line.split(" ");
        if (id !== undefined && sha !== undefined) {
          ids.set(sha, id);
        }
      }
    }
    return ids;
  });
