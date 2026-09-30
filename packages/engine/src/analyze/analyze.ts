// Owns the one entry point that turns a repository into a Report.
// It composes inventory, history, and metrics; callers never see git or parsers.
// New signals join here as new Report fields, not as new entry points.
import { Effect } from "effect";
import type { FileSystem, Path } from "effect";
import type { ChildProcessSpawner } from "effect/process";

import type { GitError } from "../git/git-errors.js";
import type { Report } from "../report/report.js";
import type { InvalidSince } from "./analysis-window.js";

/** Every expected failure of `analyze`. */
export type AnalyzeError = GitError | InvalidSince;

export type AnalyzeOptions = {
  /** A directory inside the repository; the universe is limited to files under it. */
  readonly path: string;
  /** `<n>d`, `<n>w`, `<n>m`, `<n>y`, or an ISO date (`YYYY-MM-DD`), resolved against `Clock`. */
  readonly since: string;
  /** Globs that replace the language allow-list when non-empty. */
  readonly include: ReadonlyArray<string>;
  /** Globs removed from the universe after `include`. */
  readonly exclude: ReadonlyArray<string>;
  /** Written to `Report.tool.version`. */
  readonly toolVersion: string;
};

/**
 * Analyzes the git repository containing `options.path`.
 *
 * The report lists every universe file and every coupling above the
 * thresholds, unlimited; output limits belong to the caller.
 */
export const analyze = (
  _options: AnalyzeOptions,
): Effect.Effect<
  Report,
  AnalyzeError,
  ChildProcessSpawner.ChildProcessSpawner | FileSystem.FileSystem | Path.Path
> => Effect.die("@scaffold not implemented");
