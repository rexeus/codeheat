import { describe, expect, it } from "vitest";

import type { FileStats, Report } from "../report/report.js";
import { inspect } from "./inspect.js";

const stats = (path: string, rank: number): FileStats => ({
  path,
  test: false,
  module: ".",
  rank,
  score: 1 / rank,
  revisions: 5,
  linesAdded: 0,
  linesDeleted: 0,
  breadth: 0,
  loc: 10,
  complexity: { total: 5, mean: 0.5, max: 2 },
  reasons: [],
  trend: null,
});

const family = {
  files: ["lib/c.ts", "src/a.ts"],
  similarity: { min: 0.6, max: 0.6 },
  testOnly: false,
  sharedChanges: 4,
  changesToAll: 3,
};

const reportOf = (copyFamilies: Report["copyFamilies"]): Report => ({
  schemaVersion: 1,
  tool: { name: "codeheat", version: "0.0.0-test" },
  generatedAt: "2026-06-01T12:00:00.000Z",
  repository: { name: "repo", head: null, scope: ".", shallow: false },
  window: {
    since: "2025-06-01T12:00:00.000Z",
    until: "2026-06-01T12:00:00.000Z",
    commits: 40,
    realCommits: 40,
    couplingCommits: 38,
  },
  mechanicalCommits: {
    ignored: 0,
    renames: 0,
    whitespace: 0,
    reverts: 0,
    duplicates: 0,
  },
  comparison: null,
  thresholds: {
    maxCommitFiles: 50,
    hubMinBreadth: 10,
    hubMinRevisions: 5,
    hubTopShare: 0.05,
    minModuleCommits: 5,
    minHiddenProbability: 0.5,
    minCopySimilarity: 0.5,
    minLeakage: 0.5,
    minImplementationCommits: 5,
    minSharedCommits: 3,
    minDegree: 0.3,
    ubiquitousShare: 0.3,
    ubiquitousMinCommits: 10,
    maxMeanLineLength: 300,
    maxFileBytes: 1_048_576,
  },
  totals: { files: 3, contracts: 0, couplings: 0, modules: 0 },
  files: [stats("src/a.ts", 1), stats("src/b.ts", 2), stats("lib/c.ts", 3)],
  contracts: [],
  ubiquitousFiles: [],
  couplings: [],
  modules: [],
  copyFamilies,
});

describe("inspect copy family", () => {
  it("names the family a matched file belongs to, and none for a file outside every family", () => {
    const result = inspect(reportOf([family]), ["src/*.ts"]);

    expect(
      result.matches.map(({ path, copyFamily }) => [path, copyFamily]),
    ).toEqual([
      ["src/a.ts", family],
      ["src/b.ts", null],
    ]);
  });
});
