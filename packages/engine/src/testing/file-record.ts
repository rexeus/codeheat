// Tests only: a report file with every field at its neutral value.
import type { FileStats } from "../model/analysis.js";

/** The file `path` of territory `territory`; override what a test is about. */
export const fileRecord = (
  path: string,
  territory: string,
  overrides: Partial<FileStats> = {},
): FileStats => ({
  path,
  rank: 1,
  score: 0.5,
  revisions: 10,
  changes: 10,
  linesAdded: 0,
  linesDeleted: 0,
  breadth: 0,
  test: false,
  module: ".",
  territory,
  loc: 100,
  complexity: { total: 50, mean: 1, max: 4 },
  reasons: [],
  trend: null,
  heat: null,
  ...overrides,
});
