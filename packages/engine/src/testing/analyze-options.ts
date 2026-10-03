// Tests only: `analyze` options for a temporary repository, with the defaults tests share.
import type { AnalyzeOptions } from "../analyze/analyze.js";
import type { TempRepository } from "./temp-repository.js";

/** Analyzes the whole repository over the last 12 months, every change weighing 1 and without reading any imports, unless `overrides` say otherwise. */
export const analyzeOptionsFor = (
  repo: Pick<TempRepository, "directory">,
  overrides: Partial<AnalyzeOptions> = {},
): AnalyzeOptions => ({
  cwd: repo.directory,
  since: "12m",
  halfLife: "0",
  include: [],
  exclude: [],
  entry: [],
  adapters: [],
  toolVersion: "0.0.0-test",
  ...overrides,
});
