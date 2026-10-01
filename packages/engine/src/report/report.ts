// Owns the versioned `analyze` report that agents, the CLI, and the viewer read.
// Every consumer decodes with these schemas; nothing else defines the shape.
// Additive fields keep schemaVersion 1; renaming or removing a field bumps it.
import { Schema } from "effect";

import { Module } from "./module.js";
import { Count, UnitInterval } from "./scalars.js";

const Rank = Schema.Int.check(Schema.isGreaterThanOrEqualTo(1));

/** The history range an analysis covers, resolved to ISO timestamps. */
export const AnalysisWindow = Schema.Struct({
  since: Schema.String,
  until: Schema.String,
  /** Non-merge commits in the window that touched at least one universe file. */
  commits: Count,
  /** Commits small enough to count for coupling (see `Thresholds.maxCommitFiles`). */
  couplingCommits: Count,
});

/** The noise limits an analysis applied, reported so consumers see them. */
const Thresholds = Schema.Struct({
  maxCommitFiles: Count,
  /** Fewest distinct co-changed files (`FileStats.breadth`) that make a file a hub. */
  hubMinBreadth: Count,
  /** Fewest revisions a file needs to be a hub candidate; test files are never candidates. */
  hubMinRevisions: Count,
  /** Share of the hub candidates that may be hubs: widest candidate files first, ties included. */
  hubTopShare: UnitInterval,
  minSharedCommits: Count,
  minDegree: UnitInterval,
  /**
   * Fewest counted commits a module needs to be ranked as (in)cohesive:
   * `max(5, ceil(0.01 × window.couplingCommits))`, so the floor grows with the window.
   */
  minModuleCommits: Count,
  /** Smallest `Module.leakage` at which a module's entry points get a reason line. */
  minLeakage: UnitInterval,
  /** Fewest `Module.implementationCommits` a module needs before its entry points get that reason line. */
  minImplementationCommits: Count,
  maxMeanLineLength: Count,
  maxFileBytes: Count,
});

/** One universe file: its hotspot score, the metrics behind it, and why. */
export const FileStats = Schema.Struct({
  /** Repository-relative POSIX path. */
  path: Schema.String,
  /** 1 is the hottest file; ties break on path. */
  rank: Rank,
  /** Normalized revisions × normalized weighted lines (`loc + complexity.total`); rounded to 4 decimals. */
  score: UnitInterval,
  revisions: Count,
  linesAdded: Count,
  linesDeleted: Count,
  /**
   * Distinct other universe files this file changed together with in counted
   * commits (at most `Thresholds.maxCommitFiles` files), however rarely.
   */
  breadth: Count,
  /** `path` of the file's module (see `Module`). */
  module: Schema.String,
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
});
export type FileStats = typeof FileStats.Type;

/** Two files that keep changing in the same commits. */
export const Coupling = Schema.Struct({
  a: Schema.String,
  b: Schema.String,
  sharedCommits: Count,
  /** `sharedCommits / mean(revisions(a), revisions(b))`, rounded to 4 decimals. */
  degree: UnitInterval,
  /** Directory hops between the parent directories; 0 means same directory. */
  distance: Count,
  /** One file is the other's test; expected coupling, never a smell. */
  testPair: Schema.Boolean,
  /** The files belong to different modules. Neutral: an app legitimately changes with the library it uses. */
  crossesModule: Schema.Boolean,
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
    /** Basename of the repository root. */
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
  window: AnalysisWindow,
  thresholds: Thresholds,
  /** Sizes before any output limit, so truncated reports keep their context. */
  totals: Schema.Struct({ files: Count, couplings: Count, modules: Count }),
  /** Sorted by rank. */
  files: Schema.Array(FileStats),
  /** Sorted by degree, descending. */
  couplings: Schema.Array(Coupling),
  /**
   * The ranking order, which terminal and viewer keep. First the ranked
   * modules (`commits` ≥ `Thresholds.minModuleCommits` and not `testOnly`),
   * then the other modules with commits, each group by `cohesion` ascending,
   * then more `commits` first, then `path`; last the modules without counted
   * commits (`cohesion` null), by `path`.
   */
  modules: Schema.Array(Module),
});
export type Report = typeof Report.Type;
