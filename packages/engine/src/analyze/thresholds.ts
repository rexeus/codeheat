// Owns the noise limits an analysis applies, reported so consumers see them.
import {
  MAX_COMMIT_FILES,
  MIN_DEGREE,
  MIN_SHARED_COMMITS,
} from "../coupling/coupling.js";
import {
  HUB_MIN_BREADTH,
  HUB_MIN_REVISIONS,
  HUB_TOP_SHARE,
  MIN_HIDDEN_PROBABILITY,
} from "../hotspots/reasons.js";
import { minModuleCommitsFor } from "../modules/cohesion.js";
import {
  MIN_IMPLEMENTATION_COMMITS,
  MIN_LEAKAGE,
} from "../modules/interface-churn.js";
import type { Report } from "../report/report.js";
import {
  MAX_FILE_BYTES,
  MAX_MEAN_LINE_LENGTH,
} from "../universe/source-file.js";

/** The limits an analysis applied; `couplingCommits` sets the floor of ranked modules. */
export const thresholdsFor = (couplingCommits: number) =>
  ({
    maxCommitFiles: MAX_COMMIT_FILES,
    hubMinBreadth: HUB_MIN_BREADTH,
    hubMinRevisions: HUB_MIN_REVISIONS,
    hubTopShare: HUB_TOP_SHARE,
    minModuleCommits: minModuleCommitsFor(couplingCommits),
    minHiddenProbability: MIN_HIDDEN_PROBABILITY,
    minLeakage: MIN_LEAKAGE,
    minImplementationCommits: MIN_IMPLEMENTATION_COMMITS,
    minSharedCommits: MIN_SHARED_COMMITS,
    minDegree: MIN_DEGREE,
    maxMeanLineLength: MAX_MEAN_LINE_LENGTH,
    maxFileBytes: MAX_FILE_BYTES,
  }) satisfies Report["thresholds"];
