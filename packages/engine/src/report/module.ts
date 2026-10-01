// Owns the module part of the report contract: how well each module keeps its changes to itself
// and how often its entry points change with its implementation.
// A module is a workspace package (a directory with its own manifest) or, outside packages, a directory.
// Additive fields keep schemaVersion 1; renaming or removing a field bumps it.
import { Schema } from "effect";

import { Count, UnitDelta, UnitInterval } from "./scalars.js";

/** Another module that changes in the same commits. */
const ModulePartner = Schema.Struct({
  /** The partner module's `path`. */
  path: Schema.String,
  /** Counted commits that touched both modules. */
  sharedCommits: Count,
});

/** How a module's cohesion changed against the window before (`analyze --compare`). */
const ModuleTrend = Schema.Struct({
  /** Cohesion over the previous window, rounded to 4 decimals. */
  previousCohesion: UnitInterval,
  /** `cohesion - previousCohesion`, rounded to 4 decimals; positive means the module became more self-contained. */
  cohesionDelta: UnitDelta,
});

/** A unit of the codebase and how self-contained its changes are. */
export const Module = Schema.Struct({
  /** Repository-relative POSIX directory; "." for files at the repository root. */
  path: Schema.String,
  /** `package`: the directory has its own manifest (`package.json`, `go.mod`, …); `directory`: fallback grouping. */
  kind: Schema.Literals(["package", "directory"]),
  /** Universe files in the module. */
  files: Count,
  /**
   * Every universe file in the module is test code: it has a test suffix or
   * lies below a directory named test, tests, __tests__, spec, specs, e2e,
   * fixtures, or __fixtures__. Test-only modules are never ranked.
   */
  testOnly: Schema.Boolean,
  /** Counted commits (at most `Thresholds.maxCommitFiles` files) that touched the module. */
  commits: Count,
  /** Of those, commits that touched no universe file outside the module. */
  localCommits: Count,
  /** `localCommits / commits`, rounded to 4 decimals; null when no counted commit touched the module. */
  cohesion: Schema.NullOr(UnitInterval),
  /** Modules it changes with, most shared commits first; at most five. */
  partners: Schema.Array(ModulePartner),
  /**
   * Repository-relative paths of the files that make up the module's public
   * interface, sorted: detected from `package.json` and naming conventions, or
   * the `--entry` globs. Empty when none was found.
   */
  entryPoints: Schema.Array(Schema.String),
  /** Counted commits that touched an entry point. */
  interfaceCommits: Count,
  /** Counted commits that touched a module file that is neither an entry point nor test code (see `testOnly`). */
  implementationCommits: Count,
  /**
   * Share of the `implementationCommits` that also touched an entry point,
   * rounded to 4 decimals. High values mean changes inside the module keep
   * changing its public API. Null without entry points or implementation commits.
   */
  leakage: Schema.NullOr(UnitInterval),
  /**
   * The module's interface is called out as leaky: `leakage` is at least
   * `Thresholds.minLeakage` over at least `Thresholds.minImplementationCommits`
   * implementation commits, and the module is not `testOnly`. `modules` is in
   * cohesion order, so look for this flag rather than for the first entries.
   */
  leakyInterface: Schema.Boolean,
  /** Null without `--compare`, and when the module has no counted commit in either window. */
  trend: Schema.NullOr(ModuleTrend),
});
export type Module = typeof Module.Type;
