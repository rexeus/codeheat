// Tests only: `analyze` options for a temporary repository, with the defaults tests share.
import type { AnalyzeOptions } from "../analyze/analyze.js";
import type { TempRepository } from "./temp-repository.js";

/** Analyzes the whole repository over the last 12 months unless `overrides` say otherwise. */
export const analyzeOptionsFor = (
  repo: Pick<TempRepository, "directory">,
  overrides: Partial<AnalyzeOptions> = {},
): AnalyzeOptions => ({
  cwd: repo.directory,
  since: "12m",
  include: [],
  exclude: [],
  toolVersion: "0.0.0-test",
  ...overrides,
});
