// Owns the versioned `analyze` report that agents, the CLI, and the viewer read.
// Every consumer decodes with these schemas; nothing else defines the shape.
// Additive fields keep schemaVersion 1; renaming or removing a field bumps it.
import { Schema } from "effect";

import { Clique } from "./clique.js";
import { Comparison, FileTrend } from "./comparison.js";
import { ContractFile, FileKind, UbiquitousFile } from "./contract-file.js";
import { CopyFamily } from "./copy-family.js";
import { DependencyDirection } from "./dependency-direction.js";
import { DesignFitFields } from "./design-fit-fields.js";
import { DistantCoupling } from "./distant-coupling.js";
import { Heat } from "./heat.js";
import { ImportRelation } from "./import-relation.js";
import { ModuleCoupling } from "./module-coupling.js";
import { Module } from "./module.js";
import { Count, UnitInterval } from "./scalars.js";
import { Thresholds } from "./thresholds.js";
import { UnstableInterface } from "./unstable-interface.js";
import { WindowFields } from "./window-fields.js";

const Rank = Schema.Int.check(Schema.isGreaterThanOrEqualTo(1));

/** One universe file: its hotspot score, the metrics behind it, and why. */
export const FileStats = Schema.Struct({
  /** Repository-relative POSIX path. */
  path: Schema.String,
  /** 1 is the hottest file; ties break on path. */
  rank: Rank,
  /** Normalized revisions × normalized weighted lines (`loc + complexity.total`); rounded to 4 decimals. */
  score: UnitInterval,
  /**
   * Real commits that touched the file in the window, mechanical commits
   * excluded (see `Report.mechanicalCommits`): the hotspot measure. See
   * `changes` for the logical changes they make up.
   */
  revisions: Count,
  /**
   * Counted changes of the window (logical changes of at most
   * `Thresholds.maxCommitFiles` files, see `Report.logicalChanges`) that
   * touched the file: at most `revisions`, and equal to it when no commits
   * were joined and none was too large. The unit of the file's heat
   * (`changes × (loc + complexity.total)`), `Coupling.degree`,
   * `Partner.probability`, and `Thresholds.hubMinRevisions`, which compare
   * shared changes with a file's own; a change too large to count adds to
   * none of them.
   */
  changes: Count,
  linesAdded: Count,
  linesDeleted: Count,
  /**
   * Distinct other universe files, contract files included, this file changed
   * together with in counted changes (at most `Thresholds.maxCommitFiles`
   * files), however rarely.
   */
  breadth: Count,
  /**
   * The path is test code: its name has a test suffix (`.test`, `.spec`,
   * `_test`, `_spec`) or a directory above it is named like a test directory
   * (`test`, `tests`, `__tests__`, `spec`, `specs`, `e2e`, `fixtures`,
   * `__fixtures__`) or test support directory (`testing`, `test-utils`,
   * `test-helpers`, `__mocks__`, `mocks`, `__snapshots__`). Tests are left out of the terminal's rankings of
   * warming files; apply the same rule to `trend`.
   */
  test: Schema.Boolean,
  /** `path` of the file's module (see `Module`). */
  module: Schema.String,
  /**
   * `id` of the finest territory the file belongs to (see `Territories`); test
   * code belongs to the territory of the code it tests. Walk `parent` up to the
   * territory listed at the detail you want. Empty only when the report has no
   * territories.
   */
  territory: Schema.String,
  /** Non-blank lines. */
  loc: Count,
  complexity: Schema.Struct({
    total: Count,
    /** Rounded to 4 decimals. */
    mean: Schema.Finite,
    max: Count,
  }),
  /** Human- and agent-readable explanations, most significant first. */
  reasons: Schema.Array(Schema.String),
  /** Null without `--compare`, and when either window has no real (non-mechanical) commit touching the universe. */
  trend: Schema.NullOr(FileTrend),
  /** How long the file has been among the hottest; null for a file that is neither a chronic nor an acute hotspot, for test code, and without `Report.series` (see `Heat`). */
  heat: Schema.NullOr(Heat),
});
export type FileStats = typeof FileStats.Type;

/** Two files that keep changing in the same logical changes. */
export const Coupling = Schema.Struct({
  a: Schema.String,
  b: Schema.String,
  /** Counted changes (see `Report.logicalChanges`) that touched both files. */
  sharedCommits: Count,
  /** `sharedCommits / mean(changes(a), changes(b))` (see `FileStats.changes`), rounded to 4 decimals. */
  degree: UnitInterval,
  /** Directory hops between the parent directories; 0 means same directory. */
  distance: Count,
  /** One file is the other's test; expected coupling, never a smell. */
  testPair: Schema.Boolean,
  /**
   * What each file is. A coupling with a contract side joins a contract to the
   * code that changes with it (or to another contract); the contract is listed
   * in `Report.contracts`, not in `files`.
   */
  kinds: Schema.Struct({ a: FileKind, b: FileKind }),
  /** The files belong to different modules. Neutral: an app legitimately changes with the library it uses. */
  crossesModule: Schema.Boolean,
  /** Whether a static import links the files; `none` is hidden coupling, null is unknown (see `ImportRelation`). */
  imports: ImportRelation,
});
export type Coupling = typeof Coupling.Type;

/** The full result of `analyze`. */
export const Report = Schema.Struct({
  schemaVersion: Schema.Literal(1),
  tool: Schema.Struct({
    name: Schema.Literal("codeheat"),
    version: Schema.String,
  }),
  generatedAt: Schema.String,
  repository: Schema.Struct({
    /**
     * The repository's name: the folder of its work tree, except in a linked
     * work tree (`git worktree add`) of a repository whose common directory
     * names it: the folder that holds its `.git`, or a bare repository's name
     * without `.git` (the folder that holds it, for a hidden one such as
     * `proj/.bare`). A repository whose git directory lies elsewhere
     * (`--separate-git-dir`) names none, so its work trees keep their folders.
     */
    name: Schema.String,
    /** HEAD commit, or null for a repository without commits. */
    head: Schema.NullOr(Schema.String),
    /** Repository-relative directory or file the universe is limited to; "." for all. */
    scope: Schema.String,
    /**
     * A shallow clone: history before its oldest fetched commit is missing, so
     * revisions and couplings undercount. `git fetch --unshallow` completes it.
     */
    shallow: Schema.Boolean,
  }),
  ...WindowFields,
  /** Null without `--compare`. */
  comparison: Schema.NullOr(Comparison),
  thresholds: Thresholds,
  /** Sizes before any output limit, so truncated reports keep their context. */
  totals: Schema.Struct({
    /** Code files, the ones in `files`. */
    files: Count,
    /** Contract files, the ones in `contracts`. */
    contracts: Count,
    couplings: Count,
    modules: Count,
    /**
     * Tracked files named like code or a contract (and not removed by
     * `--exclude`) that the universe leaves out as generated: below a
     * generated or vendored directory (`dist`, `build`, `vendor`,
     * `node_modules`, `generated`, `__generated__`, `tsp-output`), minified by
     * name (`.min.`), marked `linguist-generated` or `linguist-vendored`, or
     * whose content is binary, minified, or larger than
     * `Thresholds.maxFileBytes`. A file missing from the work tree or holding
     * only whitespace is left out without counting here.
     */
    generated: Count,
  }),
  /** The hotspots: every code file, sorted by rank. Contract files are never listed here. */
  files: Schema.Array(FileStats),
  /**
   * Every contract file of the universe, most revised first, ties by path.
   * They have no score; they appear in `couplings` with `kinds`.
   */
  contracts: Schema.Array(ContractFile),
  /**
   * The contract files that changed in more than `Thresholds.ubiquitousShare`
   * of the counted changes, and in at least `Thresholds.ubiquitousMinCommits`
   * of them, most changes first. A central schema or API description that
   * every change touches would couple to everything, so they join no
   * `couplings` pair, no `breadth`, and no module's cohesion or partners; they
   * stay in `contracts`. With `--compare` the previous window is judged on its
   * own changes and this lists the latest window's.
   */
  ubiquitousFiles: Schema.Array(UbiquitousFile),
  ...DesignFitFields,
  /**
   * First the pairs with at least one code side, then the pairs of two contract
   * files (`kinds`), so a limit keeps code pairs: the files of one API
   * definition change together far more often than code does. Each group is
   * sorted by degree, descending, then shared changes, then path.
   */
  couplings: Schema.Array(Coupling),
  /**
   * The ranking order, which terminal and viewer keep. First the ranked
   * modules (`commits` ≥ `Thresholds.minModuleCommits` and not `testOnly`),
   * then the other modules with counted changes, each group by `cohesion` ascending,
   * then more `commits` first, then `path`; last the modules without counted
   * changes (`cohesion` null), by `path`.
   */
  modules: Schema.Array(Module),
  /**
   * Groups of files with largely the same content that change in the same
   * logical changes, found among the coupled pairs (test pairs excluded) of the
   * analysis window. Families with production code come first, then those of
   * test code only (`testOnly`); within each, most fixes applied to all
   * members first.
   */
  copyFamilies: Schema.Array(CopyFamily),
  /**
   * The coupled pairs that lie far apart in the design (see `DistantCoupling`),
   * best first, at most 50. Ranked by `score`, so a hidden coupling between
   * distant modules comes first.
   */
  distantCouplings: Schema.Array(DistantCoupling),
  /**
   * How often pairs of ranked modules changed in the same counted changes (see
   * `ModuleCoupling`): the data of a module coupling matrix. The 200 pairs with
   * the largest `share` first, then more shared changes, then path.
   */
  moduleCoupling: Schema.Array(ModuleCoupling),
  /**
   * Groups of modules that change together (see `Clique`), at most 50, the ones
   * whose members changed together in the most changes first. A clique inside
   * another is left out, and of two variants of one unit only the stronger is
   * reported.
   */
  cliques: Schema.Array(Clique),
  /**
   * The search behind `cliques` hit a bound: more than 1000 maximal groups of
   * modules (only the 1000 with the best evidenced weakest link are searched),
   * or, in one group, more than 500 intersections or 1000 distinct parts that
   * different changes touch. A clique may be missing. False otherwise.
   */
  cliquesPartial: Schema.Boolean,
  /**
   * Files that many others depend on and that change more often than those
   * dependents, TypeScript and JavaScript only (see `UnstableInterface`); at
   * most 50, the ones that changed together with the most dependents first.
   */
  unstableInterfaces: Schema.Array(UnstableInterface),
  /**
   * Import edges from a module that rarely changes to one that changes often
   * (the Stable Dependencies Principle, see `DependencyDirection`),
   * TypeScript and JavaScript only; at most 50, ranked by `ratio` and
   * `changesTogether`.
   */
  dependencyDirection: Schema.Array(DependencyDirection),
});
export type Report = typeof Report.Type;
