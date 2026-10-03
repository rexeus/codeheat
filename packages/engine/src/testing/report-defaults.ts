// Tests only: the thresholds of an analysis with default limits, for tests that
// build a whole Report by hand.
import type { Report } from "../report/report.js";

export const DEFAULT_THRESHOLDS: Report["thresholds"] = {
  maxCommitFiles: 50,
  hubMinBreadth: 10,
  hubMinRevisions: 5,
  hubTopShare: 0.05,
  minModuleCommits: 5,
  minLocalDistance: 3,
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
};

/** The design-fit lists of a report, all empty. */
export const NO_DESIGN_FINDINGS = {
  distantCouplings: [],
} satisfies Partial<Report>;
