// Owns which pull request merge brought a commit into the repository: the
// pull request of a workflow that merges branches instead of squashing them.
import { Effect, Stream } from "effect";

import type { GitError } from "../git/git-errors.js";
import { Git } from "../git/git.js";
import { mergesOf } from "./attribution.js";
import type { PullRequestMerges } from "./attribution.js";
import { pullRequestMergeKind } from "./keys.js";

/** A merge commit and its message, as `--format=%x01%H%x00%B` prints it. */
const MERGE_RECORD = /^([0-9a-f]+)\0([\s\S]*)$/u;

const parseLine = (line: string): readonly [string, ReadonlyArray<string>] => {
  const [commit = "", ...parents] = line.split(" ");
  return [commit, parents];
};

/** The merge commits among the window's that are pull or merge requests, with their kind. */
const readPullRequestMerges = (selection: ReadonlyArray<string>) =>
  Effect.gen(function* () {
    const git = yield* Git;
    const text = yield* git.text([
      "log",
      "--merges",
      "--format=%x01%H%x00%B",
      ...selection,
    ]);
    const merges: Array<[string, "branch" | "integration"]> = [];
    for (const record of text.split("\u0001")) {
      const match = MERGE_RECORD.exec(record);
      const kind = pullRequestMergeKind(match?.[2] ?? "");
      if (match !== null && kind !== undefined) {
        merges.push([match[1] ?? "", kind]);
      }
    }
    return new Map(merges) satisfies PullRequestMerges;
  });

/**
 * Reads which pull request merge brought each commit that lies after
 * `range.since` in (see `mergesOf`), keyed by commit id. The walk starts at
 * `HEAD`, whatever the dates of the commits say, and the window's end does not
 * cut the graph: which commits count is for the caller to decide. Only merge
 * commits whose message names a pull or merge request count (see
 * `pullRequestMergeKind`), so a window without one costs a single `git log`
 * over its merge commits; otherwise the parents are read once more.
 */
export const readMerges = (range: {
  readonly since: string;
}): Effect.Effect<ReadonlyMap<string, string>, GitError, Git> =>
  Effect.gen(function* () {
    const git = yield* Git;
    const selection = [`--since=${range.since}`];
    const pullRequests = yield* readPullRequestMerges(selection);
    if (pullRequests.size === 0) {
      return new Map();
    }
    const head = (yield* git.text(["rev-parse", "HEAD"])).trim();
    const graph = new Map<string, ReadonlyArray<string>>();
    yield* git.stream(["log", "--format=%H %P", ...selection]).pipe(
      Stream.splitLines,
      Stream.filter((line) => line !== ""),
      Stream.runForEach((line) =>
        Effect.sync(() => {
          const [commit, parents] = parseLine(line);
          graph.set(commit, parents);
        }),
      ),
    );
    return mergesOf(graph, head, pullRequests);
  });
