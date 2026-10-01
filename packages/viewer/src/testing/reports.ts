import type { Coupling, FileStats, Report } from "@codeheat/engine";

/** A file with the given path; every metric can be overridden. */
export const fileStats = (
  path: string,
  overrides: Partial<FileStats> = {},
): FileStats => ({
  path,
  rank: 1,
  score: 0.5,
  revisions: 10,
  linesAdded: 100,
  linesDeleted: 20,
  breadth: 3,
  module: ".",
  loc: 100,
  complexity: { total: 200, mean: 2, max: 5 },
  reasons: [],
  ...overrides,
});

export const coupling = (
  a: string,
  b: string,
  overrides: Partial<Coupling> = {},
): Coupling => ({
  a,
  b,
  sharedCommits: 5,
  degree: 0.5,
  distance: 0,
  testPair: false,
  crossesModule: false,
  ...overrides,
});

/** A minimal valid report around the given files and couplings. */
export const reportOf = (
  files: readonly FileStats[],
  couplings: readonly Coupling[] = [],
): Report => ({
  schemaVersion: 1,
  tool: { name: "codeheat", version: "0.0.0" },
  generatedAt: "2026-09-29T12:00:00.000Z",
  repository: { name: "acme", head: null, scope: ".", shallow: false },
  window: {
    since: "2025-09-29T12:00:00.000Z",
    until: "2026-09-29T12:00:00.000Z",
    commits: 12,
    couplingCommits: 10,
  },
  thresholds: {
    maxCommitFiles: 50,
    hubMinBreadth: 10,
    hubMinRevisions: 5,
    hubTopShare: 0.05,
    minModuleCommits: 5,
    minSharedCommits: 3,
    minDegree: 0.3,
    maxMeanLineLength: 300,
    maxFileBytes: 1048576,
  },
  totals: { files: files.length, couplings: couplings.length, modules: 0 },
  files,
  couplings,
  modules: [],
});
