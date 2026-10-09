import { describe, expect, it } from "vitest";

import type { FileStats, Analysis } from "../model/analysis.js";
import {
  DEFAULT_THRESHOLDS,
  NO_DESIGN_FINDINGS,
} from "../testing/report-defaults.js";
import { inspect } from "./inspect.js";

const stats = (path: string, rank: number): FileStats => ({
  path,
  territory: "t1",
  module: ".",
  rank,
  score: 1 / rank,
  revisions: 5,
  changes: 5,
  linesAdded: 0,
  linesDeleted: 0,
  breadth: 0,
  loc: 10,
  complexity: { total: 5, mean: 0.5, max: 2 },
  reasons: [],
  trend: null,
  heat: null,
});

const family = {
  files: ["lib/c.ts", "src/a.ts"],
  similarity: { min: 0.6, max: 0.6 },
  sharedChanges: 4,
  changesToAll: 3,
};

const reportOf = (copyFamilies: Analysis["copyFamilies"]): Analysis => ({
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
    lastCommitAt: null,
  },
  mechanicalCommits: {
    ignored: 0,
    renames: 0,
    whitespace: 0,
    reverts: 0,
    duplicates: 0,
  },
  logicalChanges: { by: "commit", count: 0, largest: 0 },
  comparison: null,
  thresholds: DEFAULT_THRESHOLDS,
  totals: {
    files: 3,
    testCode: 0,
    contracts: 0,
    couplings: 0,
    modules: 0,
    generated: 0,
  },
  files: [stats("src/a.ts", 1), stats("src/b.ts", 2), stats("lib/c.ts", 3)],
  testCode: [],
  contracts: [],
  ubiquitousFiles: [],
  couplings: [],
  modules: [],
  copyFamilies,
  ...NO_DESIGN_FINDINGS,
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
