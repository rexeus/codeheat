// Owns what the analysis window's commits say about the universe's files:
// revisions, changed lines, and which files changed together. A window can be
// read as one History or split in two at a point in time.
import { Effect } from "effect";

import { groupChanges } from "../changes/group.js";
import type { GroupedBy } from "../changes/group.js";
import type { LogicalChange } from "../changes/logical-change.js";
import { readMerges } from "../changes/merges.js";
import type { GitError } from "../git/git-errors.js";
import type { Git } from "../git/git.js";
import { classify } from "../mechanical/classify.js";
import { readEvidence } from "../mechanical/evidence.js";
import { countKinds } from "../mechanical/kinds.js";
import type { MechanicalCounts, MechanicalKind } from "../mechanical/kinds.js";
import { scanCommits } from "./scan.js";
import type { Entry } from "./scan.js";
import { partitionEntries } from "./slices.js";

/** The window's activity on one file, under its current path. */
type FileHistory = {
  /** Commits that touched the file. */
  readonly revisions: number;
  /**
   * Logical changes that touched the file, of any size: the unit a coupling's
   * shared count is measured in, so ratios of shared counts use this and not
   * `revisions`.
   */
  readonly changes: number;
  readonly linesAdded: number;
  readonly linesDeleted: number;
};

/** A commit that touched the universe. */
type HistoryCommit = {
  /**
   * Why the commit is mechanical (see `MechanicalKind`), or undefined for a
   * real change. A mechanical commit adds no revisions, churn, or coupling.
   */
  readonly mechanical?: MechanicalKind | undefined;
};

export type History = {
  /** The universe paths; a file id is an index into this list. */
  readonly paths: ReadonlyArray<string>;
  /** Per commit that touched the universe. */
  readonly commits: ReadonlyArray<HistoryCommit>;
  /**
   * The real changes among them: what coupling, cohesion, and interface churn
   * count. A change is one commit, or the commits of one pull request or
   * ticket (see `groupChanges`).
   */
  readonly changes: ReadonlyArray<LogicalChange>;
  /** How `commits` were grouped into `changes`. */
  readonly logicalChanges: {
    readonly by: GroupedBy;
    readonly count: number;
    /** The most commits one change holds. */
    readonly largest: number;
  };
  /** Only files with at least one revision; mechanical commits give none. */
  readonly files: ReadonlyMap<string, FileHistory>;
  /** How many of `commits` are mechanical, per kind. */
  readonly mechanical: MechanicalCounts;
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

/** The commits of a window that are not mechanical. */
export const realCommitCount = ({ commits }: History): number =>
  commits.filter(({ mechanical }) => mechanical === undefined).length;

/** Adds one commit's lines in each of its files to the activity so far. */
const addActivity = (
  fileHistories: Map<number, FileHistory>,
  { files, added, deleted }: Entry,
): void => {
  for (const [index, id] of files.entries()) {
    const before = fileHistories.get(id);
    fileHistories.set(id, {
      revisions: (before?.revisions ?? 0) + 1,
      changes: 0,
      linesAdded: (before?.linesAdded ?? 0) + (added[index] ?? 0),
      linesDeleted: (before?.linesDeleted ?? 0) + (deleted[index] ?? 0),
    });
  }
};

/** Credits each logical change to the files it touched. */
const countChanges = (
  fileHistories: Map<number, FileHistory>,
  changes: ReadonlyArray<LogicalChange>,
): void => {
  for (const { files } of changes) {
    for (const id of files) {
      const before = fileHistories.get(id);
      if (before !== undefined) {
        fileHistories.set(id, { ...before, changes: before.changes + 1 });
      }
    }
  }
};

/**
 * Builds the history of the commits that fall in one window. A mechanical
 * commit stays a commit of the window but adds no revisions or lines.
 */
const buildHistory = (
  paths: ReadonlyArray<string>,
  entries: ReadonlyArray<Entry>,
  kinds: ReadonlyMap<string, MechanicalKind>,
  merges: ReadonlyMap<string, string>,
): History => {
  const commits: Array<HistoryCommit> = [];
  const real: Array<Entry> = [];
  const fileHistories = new Map<number, FileHistory>();
  for (const entry of entries) {
    const mechanical = kinds.get(entry.signals.sha);
    commits.push({ mechanical });
    if (mechanical === undefined) {
      real.push(entry);
      addActivity(fileHistories, entry);
    }
  }
  const { changes, by, largest } = groupChanges(
    real.map(({ signals, subject, files, previousLives, size }) => ({
      sha: signals.sha,
      time: signals.time,
      subject,
      files,
      previousLives,
      size,
    })),
    merges,
  );
  countChanges(fileHistories, changes);
  const files = new Map<string, FileHistory>();
  for (const [id, path] of paths.entries()) {
    const fileHistory = fileHistories.get(id);
    if (fileHistory !== undefined) {
      files.set(path, fileHistory);
    }
  }
  return {
    paths,
    commits,
    changes,
    logicalChanges: { by, count: changes.length, largest },
    files,
    mechanical: countKinds(kinds.values()),
  };
};

const indexPaths = (options: HistoryOptions) => {
  const paths = [...options.universe];
  return { paths, fileIds: new Map(paths.map((path, id) => [path, id])) };
};

/** Scans the window and classifies its commits, which needs git's answers about the whole scan at once. */
const readEntries = (
  options: HistoryOptions,
  fileIds: ReadonlyMap<string, number>,
) =>
  Effect.gen(function* () {
    const entries = yield* scanCommits({ ...options, fileIds });
    const evidence = yield* readEvidence(entries.map(({ signals }) => signals));
    const merges = yield* readMerges(options);
    return {
      entries,
      merges,
      kindsOf: (window: ReadonlyArray<Entry>) =>
        classify(
          window.map(({ signals }) => signals),
          evidence,
        ),
    };
  });

/**
 * Reads the non-merge commits of the window from newest to oldest.
 *
 * Git must run in the repository root, and the repository needs a `HEAD`.
 */
export const readHistory = (
  options: HistoryOptions,
): Effect.Effect<History, GitError, Git> =>
  readHistoryAndSlices(options, []).pipe(Effect.map(({ history }) => history));

/**
 * Reads the window like `readHistory` and, from the same read, the history of
 * each slice of it (see `partitionEntries` for `sliceStarts`; no slice without
 * starts). A slice is grouped from its own commits, but a commit is mechanical
 * in a slice exactly when it is in the window.
 */
export const readHistoryAndSlices = (
  options: HistoryOptions,
  sliceStarts: ReadonlyArray<number>,
): Effect.Effect<
  { readonly history: History; readonly slices: ReadonlyArray<History> },
  GitError,
  Git
> =>
  Effect.gen(function* () {
    const { paths, fileIds } = indexPaths(options);
    const { entries, merges, kindsOf } = yield* readEntries(options, fileIds);
    const kinds = kindsOf(entries);
    return {
      history: buildHistory(paths, entries, kinds, merges),
      slices: partitionEntries(entries, sliceStarts).map((slice) =>
        buildHistory(paths, slice, kinds, merges),
      ),
    };
  });

/**
 * Reads the window once and splits its commits at `splitAt`, the time in
 * seconds since the epoch: `recent` holds the commits at or after it,
 * `earlier` those before it. Renames and deletions are followed across the
 * split; reverts and duplicates are paired inside each half. `slices` are
 * those of `recent` (see `readHistoryAndSlices`).
 */
export const readHistoryHalves = (
  options: HistoryOptions,
  splitAt: number,
  sliceStarts: ReadonlyArray<number> = [],
): Effect.Effect<
  {
    readonly recent: History;
    readonly earlier: History;
    readonly slices: ReadonlyArray<History>;
  },
  GitError,
  Git
> =>
  Effect.gen(function* () {
    const { paths, fileIds } = indexPaths(options);
    const { entries, merges, kindsOf } = yield* readEntries(options, fileIds);
    const recent = entries.filter(({ signals }) => signals.time >= splitAt);
    const earlier = entries.filter(({ signals }) => signals.time < splitAt);
    const recentKinds = kindsOf(recent);
    return {
      recent: buildHistory(paths, recent, recentKinds, merges),
      earlier: buildHistory(paths, earlier, kindsOf(earlier), merges),
      slices: partitionEntries(recent, sliceStarts).map((slice) =>
        buildHistory(paths, slice, recentKinds, merges),
      ),
    };
  });
