// Owns telling a copy of a patch on a parallel line (a cherry-pick) from a
// re-land: the same patch applied again on top of the commit that first had it.
import { Effect } from "effect";

import type { GitError } from "../git/git-errors.js";
import { Git } from "../git/git.js";
import type { Duplicate } from "./duplicates.js";

/** Exit code of `git merge-base --is-ancestor` when the first commit is not an ancestor. */
const NOT_AN_ANCESTOR = 1;

const isAncestor = (
  older: string,
  newer: string,
): Effect.Effect<boolean, GitError, Git> =>
  Effect.gen(function* () {
    const git = yield* Git;
    return yield* git.text(["merge-base", "--is-ancestor", older, newer]).pipe(
      Effect.as(true),
      Effect.catchTag("GitCommandFailed", (failure) =>
        failure.exitCode === NOT_AN_ANCESTOR
          ? Effect.succeed(false)
          : Effect.fail(failure),
      ),
    );
  });

/**
 * The copies among `duplicates` that sit on top of any older copy of their
 * patch: a patch that was backed out and landed again changes the code once
 * more, where a cherry-pick on a parallel line only repeats a change that is
 * already counted. At most one `git merge-base` per older copy, the nearest
 * first, until one is an ancestor.
 */
export const readReLands = (
  duplicates: ReadonlyArray<Duplicate>,
): Effect.Effect<ReadonlySet<string>, GitError, Git> =>
  Effect.gen(function* () {
    const reLands = new Set<string>();
    for (const { older, copy } of duplicates) {
      for (const candidate of older.toReversed()) {
        if (yield* isAncestor(candidate.sha, copy.sha)) {
          reLands.add(copy.sha);
          break;
        }
      }
    }
    return reLands;
  });
