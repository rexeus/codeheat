// Owns the walk over the log: which commits touched the universe, and what
// each did to which file.
import { Effect, Stream } from "effect";

import type { GitError } from "../git/git-errors.js";
import type { Git } from "../git/git.js";
import { signalsOf } from "../mechanical/signals.js";
import type { CommitSignals } from "../mechanical/signals.js";
import { streamCommits } from "./commit-stream.js";
import { newLineage, touchUniverse } from "./lineage.js";
import type { Touch } from "./lineage.js";

/** What a scan reads. */
export type ScanOptions = {
  /** ISO timestamps bounding the window. */
  readonly since: string;
  readonly until: string;
  /** Commits whose changes are ignored, such as the boundary of a shallow clone. */
  readonly skipCommits: ReadonlySet<string>;
  /** Maps each universe path to its file id. */
  readonly fileIds: ReadonlyMap<string, number>;
};

/** A commit that touched the universe, as the scan keeps it. */
export type Entry = {
  readonly signals: CommitSignals;
  /** The distinct ids of the files whose current life the commit touched. */
  readonly files: Uint32Array;
  /** Lines the commit added and deleted in each of `files`. */
  readonly added: Uint32Array;
  readonly deleted: Uint32Array;
  /** How many distinct universe files it touched, earlier lives included. */
  readonly size: number;
};

const entryOf = (signals: CommitSignals, { lines, size }: Touch): Entry => ({
  signals,
  files: Uint32Array.from(lines.keys()),
  added: Uint32Array.from(lines.values(), (touched) => touched.added),
  deleted: Uint32Array.from(lines.values(), (touched) => touched.deleted),
  size,
});

/**
 * Streams the window's commits from newest to oldest and returns each one that
 * touched the universe, in that order. A rename makes every older commit that
 * touched the old path count for the new one, so a file keeps its history
 * under its current name, whichever window it lands in. A path deleted and
 * created again does not: the file that exists there today starts at its
 * creation, and the deleted file's changes count for nobody. Merge commits are
 * not read, so a deletion made only inside one is not seen. Commits that are
 * mechanical are read like any other, so their renames still carry history.
 *
 * The whole repository's log is read, never a path-limited one: a file moved
 * into the universe from outside keeps the history it had before the move.
 */
export const scanCommits = (
  options: ScanOptions,
): Effect.Effect<ReadonlyArray<Entry>, GitError, Git> =>
  Effect.gen(function* () {
    const lineage = newLineage();
    const entries: Array<Entry> = [];
    // The log runs from the newest commit, so a revert is read before the commit it names.
    const reverted = new Set<string>();
    yield* streamCommits([
      `--since=${options.since}`,
      `--until=${options.until}`,
    ]).pipe(
      Stream.runForEach((commit) =>
        Effect.sync(() => {
          if (options.skipCommits.has(commit.sha)) {
            return;
          }
          const touch = touchUniverse(commit, lineage, options.fileIds);
          if (commit.reverts !== undefined) {
            reverted.add(commit.reverts);
          }
          if (touch.size > 0) {
            const keep =
              commit.reverts !== undefined || reverted.has(commit.sha);
            entries.push(
              entryOf(signalsOf(commit, touch.analyzed, keep), touch),
            );
          }
        }),
      ),
    );
    return entries;
  });
