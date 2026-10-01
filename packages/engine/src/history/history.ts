// Owns what the analysis window's commits say about the universe's files:
// revisions, changed lines, and which files changed together. A window can be
// read as one History or split in two at a point in time.
import { Effect, Stream } from "effect";

import type { GitError } from "../git/git-errors.js";
import { Git } from "../git/git.js";
import { LOG_FORMAT_ARGS, LogParser } from "./parse-log.js";
import type { Commit } from "./parse-log.js";

/** The window's activity on one file, under its current path. */
type FileHistory = {
  /** Commits that touched the file. */
  readonly revisions: number;
  readonly linesAdded: number;
  readonly linesDeleted: number;
};

export type History = {
  /** The universe paths; a file id is an index into this list. */
  readonly paths: ReadonlyArray<string>;
  /** Per commit that touched the universe, the distinct file ids it touched. */
  readonly commits: ReadonlyArray<Uint32Array>;
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

type Lines = { readonly added: number; readonly deleted: number };

const addLines = (total: Lines | undefined, more: Lines): Lines => ({
  added: (total?.added ?? 0) + more.added,
  deleted: (total?.deleted ?? 0) + more.deleted,
});

/**
 * The lines the commit changed per file id. Records the commit's renames in
 * `renamedTo`, which maps old paths to current ones.
 */
const linesByFileId = (
  commit: Commit,
  renamedTo: Map<string, string>,
  fileIds: ReadonlyMap<string, number>,
): ReadonlyMap<number, Lines> => {
  const lines = new Map<number, Lines>();
  for (const change of commit.changes) {
    const path = renamedTo.get(change.path) ?? change.path;
    if (change.renamedFrom !== undefined) {
      renamedTo.set(change.renamedFrom, path);
    }
    const id = fileIds.get(path);
    if (id !== undefined) {
      lines.set(id, addLines(lines.get(id), change));
    }
  }
  return lines;
};

/** Collects the commits routed to it into one `History`. */
const makeCollector = (paths: ReadonlyArray<string>) => {
  const commits: Array<Uint32Array> = [];
  const fileHistories = new Map<number, FileHistory>();
  return {
    add: (touched: ReadonlyMap<number, Lines>): void => {
      for (const [id, lines] of touched) {
        const before = fileHistories.get(id);
        fileHistories.set(id, {
          revisions: (before?.revisions ?? 0) + 1,
          linesAdded: (before?.linesAdded ?? 0) + lines.added,
          linesDeleted: (before?.linesDeleted ?? 0) + lines.deleted,
        });
      }
      commits.push(Uint32Array.from(touched.keys()));
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
 *
 * The whole repository's log is read, never a path-limited one: a file moved
 * into the universe from outside keeps the history it had before the move.
 */
const scanCommits = (
  options: HistoryOptions,
  fileIds: ReadonlyMap<string, number>,
  route: (time: number, touched: ReadonlyMap<number, Lines>) => void,
): Effect.Effect<void, GitError, Git> =>
  Effect.gen(function* () {
    const git = yield* Git;
    const renamedTo = new Map<string, string>();
    const absorb = (commit: Commit): void => {
      if (options.skipCommits.has(commit.sha)) {
        return;
      }
      const touched = linesByFileId(commit, renamedTo, fileIds);
      if (touched.size > 0) {
        route(commit.time, touched);
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
    yield* scanCommits(options, fileIds, (_time, touched) => {
      collector.add(touched);
    });
    return collector.finish();
  });

/**
 * Reads the window once and splits its commits at `splitAt`, the time in
 * seconds since the epoch: `recent` holds the commits at or after it,
 * `earlier` those before it. Renames are followed across the split.
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
    yield* scanCommits(options, fileIds, (time, touched) => {
      (time >= splitAt ? recent : earlier).add(touched);
    });
    return { recent: recent.finish(), earlier: earlier.finish() };
  });
