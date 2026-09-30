// Owns the versioned `analyze` report that agents, the CLI, and the viewer read.
// Every consumer decodes with these schemas; nothing else defines the shape.
// Additive fields keep schemaVersion 1; renaming or removing a field bumps it.
import { Schema } from "effect";

export const Count = Schema.Natural;
export const UnitInterval = Schema.Finite.check(
  Schema.isBetween({ minimum: 0, maximum: 1 }),
);
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
  minSharedCommits: Count,
  minDegree: UnitInterval,
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
    /** Repository-relative directory the universe is limited to; "." for all. */
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
  totals: Schema.Struct({ files: Count, couplings: Count }),
  /** Sorted by rank. */
  files: Schema.Array(FileStats),
  /** Sorted by degree, descending. */
  couplings: Schema.Array(Coupling),
});
export type Report = typeof Report.Type;
