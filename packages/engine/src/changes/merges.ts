// Owns which pull request merge brought a commit into the repository: the
// pull request of a workflow that merges branches instead of squashing them.
import { Effect, Stream } from "effect";

import type { GitError } from "../git/git-errors.js";
import { Git } from "../git/git.js";
import { mergesOf } from "./attribution.js";
import { isPullRequestMerge } from "./keys.js";

/** A merge commit and its message, as `--format=%x01%H%x00%B` prints it. */
const MERGE_RECORD = /^([0-9a-f]+)\0([\s\S]*)$/u;

const parseLine = (line: string): readonly [string, ReadonlyArray<string>] => {
  const [commit = "", ...parents] = line.split(" ");
  return [commit, parents];
};

/** The merge commits among the window's that are pull or merge requests, by commit id. */
const readPullRequestMerges = (selection: ReadonlyArray<string>) =>
  Effect.gen(function* () {
    const git = yield* Git;
    const text = yield* git.text([
      "log",
      "--merges",
      "--format=%x01%H%x00%B",
      ...selection,
    ]);
    const merges = text.split("\u0001").flatMap((record) => {
      const match = MERGE_RECORD.exec(record);
      return match === null
        ? []
        : [{ sha: match[1] ?? "", message: match[2] ?? "" }];
    });
    return new Set(
      merges
        .filter(({ message }) => isPullRequestMerge(message))
        .map(({ sha }) => sha),
    );
  });

/**
 * Reads which pull request merge brought each commit of the window in (see
 * `mergesOf`), keyed by commit id. Only merge commits whose message names a
 * pull or merge request count (see `isPullRequestMerge`), so a window without
 * one costs a single `git log` over its merge commits; otherwise the window's
 * parents are read once more.
 */
export const readMerges = (range: {
  readonly since: string;
  readonly until: string;
}): Effect.Effect<ReadonlyMap<string, string>, GitError, Git> =>
  Effect.gen(function* () {
    const git = yield* Git;
    const selection = [`--since=${range.since}`, `--until=${range.until}`];
    const pullRequests = yield* readPullRequestMerges(selection);
    if (pullRequests.size === 0) {
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
    return tip === undefined ? new Map() : mergesOf(graph, tip, pullRequests);
  });
