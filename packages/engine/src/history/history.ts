// Owns what the analysis window's commits say about the universe's files:
// revisions, changed lines, and which files changed together. One read of the
// log is divided into the windows of an analysis and the slices of its series.
import { Effect } from "effect";

import type { GroupedBy } from "../changes/group.js";
import type { LogicalChange } from "../changes/logical-change.js";
import type { GitError } from "../git/git-errors.js";
import type { Git } from "../git/git.js";
import { readEvidence } from "../mechanical/evidence.js";
import { countKinds } from "../mechanical/kinds.js";
import type { MechanicalCounts, MechanicalKind } from "../mechanical/kinds.js";
import { isTestPath } from "../modules/test-path.js";
import type { SliceRange } from "../series/slice-ranges.js";
import { classifierFor } from "./classifier.js";
import { measureChanges } from "./measured-changes.js";
import { scanCommits } from "./scan.js";
import type { Entry } from "./scan.js";
import { sliceSeries } from "./slices.js";

/** The window's activity on one file, under its current path. */
type FileHistory = {
  /** Commits that touched the file. */
  readonly revisions: number;
  /**
   * Counted changes that touched the file (see `countedChanges`): the unit a
   * coupling's shared count and a file's heat are measured in, so ratios of
   * shared counts use this and not `revisions`. A change too large to count
   * adds none. Test code counts the changes its commits belong to, though it
   * is no part of them.
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
  /**
   * Whether it touched a file that is no test code (one dead today included):
   * a commit of test code alone is part of no change.
   */
  readonly code: boolean;
};

export type History = {
  /** The universe paths; a file id is an index into this list. */
  readonly paths: ReadonlyArray<string>;
  /** Per commit that touched the universe. */
  readonly commits: ReadonlyArray<HistoryCommit>;
  /**
   * The real changes among them: what coupling, cohesion, and interface churn
   * count. A change is one commit, or the commits of one pull request or
   * ticket (see `groupChanges`), and holds only the files that are no test
   * code (see `isTestPath`): tests are no design, so no measure sees them. A
   * change that touched nothing but test code is none.
   */
  readonly changes: ReadonlyArray<LogicalChange>;
  /** How `commits` were grouped into `changes`. */
  readonly logicalChanges: {
    readonly by: GroupedBy;
    readonly count: number;
    /** The most commits one change holds. */
    readonly largest: number;
  };
  /** Only files with at least one revision, test code included; mechanical commits give none. */
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

/** The commits of a window that are not mechanical and touched code other than test code: those its changes are made of. */
export const realCommitCount = ({ commits }: History): number =>
  commits.filter(({ mechanical, code }) => mechanical === undefined && code)
    .length;

/** Whether a commit touched a file that is no test code (`isTest` by file id). */
const touchesCode = (
  { files, previousLives }: Entry,
  isTest: ReadonlyArray<boolean>,
): boolean =>
  files.some((id) => isTest[id] !== true) ||
  previousLives.some((id) => isTest[id] !== true);

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

/**
 * Builds the history of the commits that fall in one window. A mechanical
 * commit stays a commit of the window but adds no revisions or lines.
 */
const buildHistory = (
  { paths, isTest }: IndexedPaths,
  entries: ReadonlyArray<Entry>,
  kinds: ReadonlyMap<string, MechanicalKind>,
  merges: ReadonlyMap<string, string>,
): History => {
  const commits: Array<HistoryCommit> = [];
  const real: Array<Entry> = [];
  const fileHistories = new Map<number, FileHistory>();
  for (const entry of entries) {
    const mechanical = kinds.get(entry.signals.sha);
    commits.push({ mechanical, code: touchesCode(entry, isTest) });
    if (mechanical === undefined) {
      real.push(entry);
      addActivity(fileHistories, entry);
    }
  }
  const measured = measureChanges(real, isTest, merges);
  const files = new Map<string, FileHistory>();
  for (const [id, path] of paths.entries()) {
    const fileHistory = fileHistories.get(id);
    if (fileHistory !== undefined) {
      files.set(path, {
        ...fileHistory,
        changes: measured.changesOf.get(id) ?? 0,
      });
    }
  }
  return {
    paths,
    commits,
    changes: measured.changes,
    logicalChanges: measured.logicalChanges,
    files,
    mechanical: countKinds(kinds.values()),
  };
};

const seconds = (iso: string): number => Math.floor(Date.parse(iso) / 1000);

/** The universe paths, a file id being an index into them, and which of them are test code. */
type IndexedPaths = {
  readonly paths: ReadonlyArray<string>;
  readonly isTest: ReadonlyArray<boolean>;
};

const indexPaths = (options: HistoryOptions) => {
  const paths = [...options.universe];
  return {
    paths,
    isTest: paths.map((path) => isTestPath(path)),
    fileIds: new Map(paths.map((path, id) => [path, id])),
  };
};

/** One slice of the series and the time range it covers. */
export type SeriesSlice = {
  readonly range: SliceRange;
  readonly history: History;
};

/** How one read of the log is divided into the windows an analysis needs. */
export type HistoryParts = {
  /** ISO time at which the windows start: the one before the latest when comparing, else the latest. */
  readonly windowsSince: string;
  /** Seconds since the epoch: the commits from here on make the window the report describes. */
  readonly currentFrom: number;
  /** When comparing, the seconds at which the window before it starts; it ends at `currentFrom`. Null otherwise. */
  readonly previousFrom: number | null;
  /** ISO time at which the series starts; it ends at `options.until`. */
  readonly seriesSince: string;
};

/**
 * Reads the non-merge commits from `options.since`, newest to oldest, once,
 * and divides them: `current` is the window from `parts.currentFrom`, `previous`
 * the one before it when comparing, and `series` the commits from
 * `parts.seriesSince` cut into slices (see `sliceSeries`), whatever the other
 * two cover. `options.since` must not be later than `parts.windowsSince` or
 * `parts.seriesSince`. Renames and deletions are followed across every
 * boundary.
 *
 * What the windows say is what reading just their span (from
 * `parts.windowsSince`) would say: reverts, re-lands, and duplicates are
 * looked for inside it, and so are the merges that group commits into pull
 * requests (see `classifierFor`). The slices are classified and grouped the
 * same way over the series span, so a commit can be mechanical in a slice and
 * not in the window, or the other way. A slice is grouped from its own commits.
 *
 * Git must run in the repository root, and the repository needs a `HEAD`.
 */
export const readHistories = (
  options: HistoryOptions,
  parts: HistoryParts,
): Effect.Effect<
  {
    readonly current: History;
    readonly previous: History | null;
    readonly series: ReadonlyArray<SeriesSlice>;
  },
  GitError,
  Git
> =>
  Effect.gen(function* () {
    const { fileIds, ...indexed } = indexPaths(options);
    const scanned = yield* scanCommits({ ...options, fileIds });
    const evidence = yield* readEvidence(scanned.map(({ signals }) => signals));
    const within = (from: number, until: number) =>
      scanned.filter(
        ({ signals }) => signals.time >= from && signals.time < until,
      );
    const windows = within(
      seconds(parts.windowsSince),
      Number.POSITIVE_INFINITY,
    );
    const forWindows = yield* classifierFor(
      evidence,
      windows,
      parts.windowsSince,
    );
    const build = (
      window: ReadonlyArray<Entry>,
      { kindsOf, merges } = forWindows,
      kinds = kindsOf(window),
    ) => buildHistory(indexed, window, kinds, merges);
    const series = sliceSeries(scanned, parts.seriesSince, options.until);
    const sameSpan =
      series.slices.length === 0 ||
      Date.parse(parts.seriesSince) === Date.parse(parts.windowsSince);
    const forSeries = sameSpan
      ? forWindows
      : yield* classifierFor(evidence, series.entries, parts.seriesSince);
    const seriesKinds = forSeries.kindsOf(series.entries);
    return {
      current: build(within(parts.currentFrom, Number.POSITIVE_INFINITY)),
      previous:
        parts.previousFrom === null
          ? null
          : build(within(parts.previousFrom, parts.currentFrom)),
      series: series.slices.map(({ range, entries: slice }) => ({
        range,
        history: build(slice, forSeries, seriesKinds),
      })),
    };
  });
