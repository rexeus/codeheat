// Owns the module part of the report contract: how well each module keeps its changes to itself
// and how often its entry points change with its implementation.
// A module is a workspace package (a directory with its own manifest) or, outside packages, a directory.
// Additive fields keep schemaVersion 1; renaming or removing a field bumps it.
import { Schema } from "effect";

import { Count, UnitDelta, UnitInterval } from "./scalars.js";

/** Another module that changes in the same logical changes (see `Report.logicalChanges`). */
const ModulePartner = Schema.Struct({
  /** The partner module's `path`. */
  path: Schema.String,
  /** Counted changes that touched both modules. */
  sharedCommits: Count,
  /**
   * `path` is no module of the report but a place that holds only contract
   * files, such as a code-free `spec/` folder: the module changes with an
   * interface definition that lives outside every module.
   */
  contractsOnly: Schema.Boolean,
});

/** How a module's cohesion changed against the window before (`analyze --compare`). */
const ModuleTrend = Schema.Struct({
  /** Cohesion over the previous window, rounded to 4 decimals. */
  previousCohesion: UnitInterval,
  /** `cohesion - previousCohesion`, rounded to 4 decimals; positive means the module became more self-contained. */
  cohesionDelta: UnitDelta,
});

/** How much implementation sits behind a module's public interface. */
const ModuleDepth = Schema.Struct({
  /**
   * Distinct names the module's entry points export, following
   * `export * from` within the module; `export { x } from` and
   * `export * as ns from` add their names. As in ECMAScript, a file's own
   * export wins over `export *`, `export *` never forwards `default`, and a
   * name that two `export *` sources export as different bindings is exported
   * by neither (the same binding reached twice counts once). A name taken by
   * a named re-export counts even when its source is out of sight (an excluded
   * or missing file, an asset). A name that
   * several entry points export counts once. A type counts like a value,
   * `default` like a name.
   */
  exports: Schema.Int.check(Schema.isGreaterThanOrEqualTo(1)),
  /** Non-blank lines of the module's files that are neither entry points, test code, nor tool configuration (`*.config.{js,ts,mjs,…}`). At least 1. */
  implementationLines: Schema.Int.check(Schema.isGreaterThanOrEqualTo(1)),
  /**
   * `implementationLines / exports`, rounded to 4 decimals. A low value is a
   * shallow module (a wide interface with little behind it), a high one a deep
   * module. It depends on how the code is divided into files, and on entry
   * points holding code of their own, whose lines count for neither side.
   */
  linesPerExport: Schema.Finite.check(Schema.isGreaterThanOrEqualTo(0)),
});

/** A unit of the codebase and how self-contained its changes are. */
export const Module = Schema.Struct({
  /** Repository-relative POSIX directory; "." for files at the repository root. */
  path: Schema.String,
  /** `package`: the directory has its own manifest (`package.json`, `go.mod`, …); `directory`: fallback grouping, also of a lone package or other module that held most of the files and was split by directory. */
  kind: Schema.Literals(["package", "directory"]),
  /** Universe files in the module. */
  files: Count,
  /**
   * Every universe file in the module is test code: it has a test suffix or
   * lies below a directory named test, tests, __tests__, spec, specs, e2e,
   * fixtures, __fixtures__, testing, test-utils, test-helpers, __mocks__,
   * mocks, or __snapshots__. Test-only modules are never ranked.
   */
  testOnly: Schema.Boolean,
  /** Counted changes (logical changes of at most `Thresholds.maxCommitFiles` files, see `Report.logicalChanges`) that touched the module. */
  commits: Count,
  /** Of those, changes that touched no universe file outside the module. */
  localCommits: Count,
  /** `localCommits / commits`, rounded to 4 decimals; null when no counted change touched the module. */
  cohesion: Schema.NullOr(UnitInterval),
  /**
   * The change radius around the module: the median number of modules,
   * itself included, that the counted changes touching it touched (see
   * `Report.changeRadius`; test-only modules are not counted, and a lower
   * median keeps it a whole number). 1 means its changes usually stay inside.
   * Null when no counted change touched it, and for a test-only module.
   */
  radius: Schema.NullOr(Schema.Int.check(Schema.isGreaterThanOrEqualTo(1))),
  /** Modules it changes with, most shared changes first; at most five. */
  partners: Schema.Array(ModulePartner),
  /**
   * Repository-relative paths of the files that make up the module's public
   * interface, sorted: detected from `package.json` and naming conventions, or
   * the `--entry` globs. Empty when none was found.
   */
  entryPoints: Schema.Array(Schema.String),
  /** Counted changes that touched an entry point. */
  interfaceCommits: Count,
  /** Counted changes that touched a module file that is neither an entry point nor test code (see `testOnly`). */
  implementationCommits: Count,
  /**
   * Share of the `implementationCommits` that also touched an entry point,
   * rounded to 4 decimals. High values mean changes inside the module keep
   * changing its public API. Null without entry points or implementation changes.
   */
  leakage: Schema.NullOr(UnitInterval),
  /**
   * The module's interface is called out as leaky: `leakage` is at least
   * `Thresholds.minLeakage` over at least `Thresholds.minImplementationCommits`
   * implementation changes, and the module is not `testOnly`. `modules` is in
   * cohesion order, so look for this flag rather than for the first entries.
   */
  leakyInterface: Schema.Boolean,
  /**
   * Implementation size against interface width, read from the code as it is
   * now (not from the window). Null whenever it cannot be told exactly: the
   * module has no entry points, one of them is not TypeScript or JavaScript or
   * does not parse (or no parser was available), it exports in a way that
   * cannot be listed (`export =`, CommonJS), an `export * from` cannot be
   * followed within the module (an external package, an unresolved specifier,
   * a specifier that resolves to several files, a file of another module), or
   * two bindings of a name cannot be told apart, it exports nothing, or no file is left to
   * count as implementation (all code sits in the entry points, in test code
   * or in configuration files). Null is never a depth of zero.
   */
  depth: Schema.NullOr(ModuleDepth),
  /**
   * Null without `--compare`, and unless the module has at least
   * `Thresholds.minModuleCommits` counted changes in both windows (so also
   * when either window has none): the cohesion of a few changes swings too
   * much to call a change.
   */
  trend: Schema.NullOr(ModuleTrend),
});
export type Module = typeof Module.Type;
