// Tests only: a whole analysis of a quiet repository without files, for tests
// that set the parts they are about.
import type { Analysis } from "../model/analysis.js";
import { DEFAULT_THRESHOLDS, NO_DESIGN_FINDINGS } from "./report-defaults.js";

/** An analysis with no files and no changes; override what a test is about. */
export const analysisRecord = (
  overrides: Partial<Analysis> = {},
): Analysis => ({
  schemaVersion: 1,
  tool: { name: "codeheat", version: "0.0.0-test" },
  generatedAt: "2026-06-01T12:00:00.000Z",
  repository: { name: "repo", head: null, scope: ".", shallow: false },
  window: {
    since: "2025-06-01T12:00:00.000Z",
    until: "2026-06-01T12:00:00.000Z",
    commits: 0,
    realCommits: 0,
    couplingCommits: 0,
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
  totals: { files: 0, contracts: 0, couplings: 0, modules: 0, generated: 0 },
  files: [],
  contracts: [],
  ubiquitousFiles: [],
  couplings: [],
  modules: [],
  copyFamilies: [],
  ...NO_DESIGN_FINDINGS,
  ...overrides,
});
