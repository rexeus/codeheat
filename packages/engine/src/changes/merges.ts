// Owns which merge commit brought a commit into the repository: the pull
// request of a workflow that merges branches instead of squashing them.
import { Effect, Stream } from "effect";

import type { GitError } from "../git/git-errors.js";
import { Git } from "../git/git.js";
import { mergesOf } from "./attribution.js";

const parseLine = (line: string): readonly [string, ReadonlyArray<string>] => {
  const [commit = "", ...parents] = line.split(" ");
  return [commit, parents];
};

/**
 * Reads which merge commit brought each commit of the window in (see
 * `mergesOf`), keyed by commit id. A window without a merge commit costs one
 * short `git log`; otherwise the window's parents are read once more.
 */
export const readMerges = (range: {
  readonly since: string;
  readonly until: string;
}): Effect.Effect<ReadonlyMap<string, string>, GitError, Git> =>
  Effect.gen(function* () {
    const git = yield* Git;
    const selection = [`--since=${range.since}`, `--until=${range.until}`];
    const anyMerge = yield* git.text([
      "log",
      "--merges",
      "--max-count=1",
      "--format=%H",
      ...selection,
    ]);
    if (anyMerge.trim() === "") {
      return new Map();
    }
    const graph = new Map<string, ReadonlyArray<string>>();
    let tip: string | undefined;
    yield* git.stream(["log", "--format=%H %P", ...selection]).pipe(
      Stream.splitLines,
      Stream.filter((line) => line !== ""),
      Stream.runForEach((line) =>
        Effect.sync(() => {
          const [commit, parents] = parseLine(line);
          tip ??= commit;
          graph.set(commit, parents);
        }),
      ),
    );
    return tip === undefined ? new Map() : mergesOf(graph, tip);
  });
