// Owns what the analysis window's commits say about the universe's files:
// revisions, changed lines, and which files changed together. A window can be
// read as one History or split in two at a point in time.
import { Effect, Stream } from "effect";

import type { GitError } from "../git/git-errors.js";
import { Git } from "../git/git.js";
import { newLineage, touchUniverse } from "./lineage.js";
import type { Touch } from "./lineage.js";
import { LOG_FORMAT_ARGS, LogParser } from "./parse-log.js";
import type { Commit } from "./parse-log.js";

/** The window's activity on one file, under its current path. */
type FileHistory = {
  /** Commits that touched the file. */
  readonly revisions: number;
  readonly linesAdded: number;
  readonly linesDeleted: number;
};

/** A commit that touched the universe. */
export type HistoryCommit = {
  /**
   * The distinct ids of the files whose current file the commit touched; none
   * when it only touched earlier files that lived at a universe path.
   */
  readonly files: Uint32Array;
  /**
   * How many distinct universe files it touched, earlier ones included: the
   * size that decides whether a commit is too large to count. It never
   * shrinks for files that are dead today.
   */
  readonly size: number;
};

export type History = {
  /** The universe paths; a file id is an index into this list. */
  readonly paths: ReadonlyArray<string>;
  /** Per commit that touched the universe. */
  readonly commits: ReadonlyArray<HistoryCommit>;
  /** Only files with at least one revision. */
  readonly files: ReadonlyMap<string, FileHistory>;
};

export type HistoryOptions = {
  /** ISO timestamps bounding the window. */
  readonly since: string;
  readonly until: string;
  /** Commits whose changes are ignored, such as the boundary of a shallow clone. */
  readonly skipCommits: ReadonlySet<string>;
  /** Current paths that count; changes to any other path are dropped. */
  readonly universe: ReadonlySet<string>;
};

/** Collects the commits routed to it into one `History`. */
const makeCollector = (paths: ReadonlyArray<string>) => {
  const commits: Array<HistoryCommit> = [];
  const fileHistories = new Map<number, FileHistory>();
  return {
    add: ({ lines: touched, size }: Touch): void => {
      for (const [id, lines] of touched) {
        const before = fileHistories.get(id);
        fileHistories.set(id, {
          revisions: (before?.revisions ?? 0) + 1,
          linesAdded: (before?.linesAdded ?? 0) + lines.added,
          linesDeleted: (before?.linesDeleted ?? 0) + lines.deleted,
        });
      }
      commits.push({ files: Uint32Array.from(touched.keys()), size });
    },
    finish: (): History => {
      const files = new Map<string, FileHistory>();
      for (const [id, path] of paths.entries()) {
        const fileHistory = fileHistories.get(id);
        if (fileHistory !== undefined) {
          files.set(path, fileHistory);
        }
      }
      return { paths, commits, files };
    },
  };
};

/**
 * Streams the window's commits from newest to oldest and hands each one that
 * touched the universe to `route` with its commit time. A rename makes every
 * older commit that touched the old path count for the new one, so a file
 * keeps its history under its current name, whichever collector it lands in.
 * A path deleted and created again does not: the file that exists there today
 * starts at its creation, and the deleted file's changes count for nobody,
 * whichever side of a split they fall on. Merge commits are not read, so a
 * deletion made only inside one is not seen.
 *
 * The whole repository's log is read, never a path-limited one: a file moved
 * into the universe from outside keeps the history it had before the move.
 */
const scanCommits = (
  options: HistoryOptions,
  fileIds: ReadonlyMap<string, number>,
  route: (time: number, touch: Touch) => void,
): Effect.Effect<void, GitError, Git> =>
  Effect.gen(function* () {
    const git = yield* Git;
    const lineage = newLineage();
    const absorb = (commit: Commit): void => {
      if (options.skipCommits.has(commit.sha)) {
        return;
      }
      const touch = touchUniverse(commit, lineage, fileIds);
      if (touch.size > 0) {
        route(commit.time, touch);
      }
    };

    yield* git
      .stream([
        "log",
        ...LOG_FORMAT_ARGS,
        `--since=${options.since}`,
        `--until=${options.until}`,
      ])
      .pipe(
        Stream.mapAccum(
          () => new LogParser(),
          (parser, chunk) => [parser, parser.push(chunk)],
          { onHalt: (parser) => parser.end() },
        ),
        Stream.runForEach((commit) =>
          Effect.sync(() => {
            absorb(commit);
          }),
        ),
      );
  });

const indexPaths = (options: HistoryOptions) => {
  const paths = [...options.universe];
  return { paths, fileIds: new Map(paths.map((path, id) => [path, id])) };
};

/**
 * Reads the non-merge commits of the window from newest to oldest.
 *
 * Git must run in the repository root, and the repository needs a `HEAD`.
 */
export const readHistory = (
  options: HistoryOptions,
): Effect.Effect<History, GitError, Git> =>
  Effect.gen(function* () {
    const { paths, fileIds } = indexPaths(options);
    const collector = makeCollector(paths);
    yield* scanCommits(options, fileIds, (_time, touch) => {
      collector.add(touch);
    });
    return collector.finish();
  });

/**
 * Reads the window once and splits its commits at `splitAt`, the time in
 * seconds since the epoch: `recent` holds the commits at or after it,
 * `earlier` those before it. Renames and deletions are followed across the
 * split.
 */
export const readHistoryHalves = (
  options: HistoryOptions,
  splitAt: number,
): Effect.Effect<
  { readonly recent: History; readonly earlier: History },
  GitError,
  Git
> =>
  Effect.gen(function* () {
    const { paths, fileIds } = indexPaths(options);
    const recent = makeCollector(paths);
    const earlier = makeCollector(paths);
    yield* scanCommits(options, fileIds, (time, touch) => {
      (time >= splitAt ? recent : earlier).add(touch);
    });
    return { recent: recent.finish(), earlier: earlier.finish() };
  });
