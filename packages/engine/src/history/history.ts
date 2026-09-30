// Owns what the analysis window's commits say about the universe's files:
// revisions, changed lines, and which files changed together.
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
  /** Per commit that touched the universe, the distinct universe paths it touched. */
  readonly commits: ReadonlyArray<ReadonlyArray<string>>;
  /** Only files with at least one revision. */
  readonly files: ReadonlyMap<string, FileHistory>;
};

export type HistoryOptions = {
  /** ISO timestamps bounding the window. */
  readonly since: string;
  readonly until: string;
  /** Repository-relative directory to read history for; "." for all. */
  readonly scope: string;
  /** Current paths that count; changes to any other path are dropped. */
  readonly universe: ReadonlySet<string>;
};

type Lines = { readonly added: number; readonly deleted: number };

const addLines = (total: Lines | undefined, more: Lines): Lines => ({
  added: (total?.added ?? 0) + more.added,
  deleted: (total?.deleted ?? 0) + more.deleted,
});

/**
 * The lines the commit changed per current universe path. Records the
 * commit's renames in `renamedTo`, which maps old paths to current ones.
 */
const linesByUniversePath = (
  commit: Commit,
  renamedTo: Map<string, string>,
  universe: ReadonlySet<string>,
): ReadonlyMap<string, Lines> => {
  const lines = new Map<string, Lines>();
  for (const change of commit.changes) {
    const path = renamedTo.get(change.path) ?? change.path;
    if (change.renamedFrom !== undefined) {
      renamedTo.set(change.renamedFrom, path);
    }
    if (universe.has(path)) {
      lines.set(path, addLines(lines.get(path), change));
    }
  }
  return lines;
};

/**
 * Reads the non-merge commits of the window from newest to oldest. A rename
 * makes every older commit that touched the old path count for the new one,
 * so a file keeps its history under its current name.
 *
 * Git must run in the repository root, and the repository needs a `HEAD`.
 */
export const readHistory = (
  options: HistoryOptions,
): Effect.Effect<History, GitError, Git> =>
  Effect.gen(function* () {
    const git = yield* Git;
    const renamedTo = new Map<string, string>();
    const commits: Array<ReadonlyArray<string>> = [];
    const files = new Map<string, FileHistory>();

    const absorb = (commit: Commit): void => {
      const touched = linesByUniversePath(commit, renamedTo, options.universe);
      for (const [path, lines] of touched) {
        const before = files.get(path);
        files.set(path, {
          revisions: (before?.revisions ?? 0) + 1,
          linesAdded: (before?.linesAdded ?? 0) + lines.added,
          linesDeleted: (before?.linesDeleted ?? 0) + lines.deleted,
        });
      }
      if (touched.size > 0) {
        commits.push([...touched.keys()]);
      }
    };

    const scope = options.scope === "." ? [] : [`:(literal)${options.scope}`];
    yield* git
      .stream([
        "log",
        ...LOG_FORMAT_ARGS,
        `--since=${options.since}`,
        `--until=${options.until}`,
        "--",
        ...scope,
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

    return { commits, files };
  });
