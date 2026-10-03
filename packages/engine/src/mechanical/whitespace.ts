// Owns telling which commits change nothing but whitespace, as git sees it.
import { Effect, Stream } from "effect";

import type { GitError } from "../git/git-errors.js";
import type { Git } from "../git/git.js";
import { streamCommits } from "../history/commit-stream.js";

/**
 * The commits among `shas` whose diff `git log -w` shows no changed line for.
 * `-w` omits a file whose only changes are whitespace from the numstat, so a
 * commit left without any change differs from its parent in whitespace alone;
 * a binary file or a mode change keeps its entry.
 */
export const readWhitespaceOnly = (
  shas: ReadonlyArray<string>,
): Effect.Effect<ReadonlySet<string>, GitError, Git> =>
  Effect.gen(function* () {
    const found = new Set<string>();
    if (shas.length === 0) {
      return found;
    }
    yield* streamCommits(
      ["--no-walk=unsorted", "--stdin", "-w"],
      `${shas.join("\n")}\n`,
    ).pipe(
      Stream.runForEach((commit) =>
        Effect.sync(() => {
          if (commit.changes.length === 0) {
            found.add(commit.sha);
          }
        }),
      ),
    );
    return found;
  });
