import {
  UBIQUITOUS_MIN_COMMITS,
  UBIQUITOUS_SHARE,
} from "../contracts/ubiquitous.js";
// Owns the noise limits an analysis applies, reported so consumers see them.
import { MIN_COPY_SIMILARITY } from "../copies/find-copy-families.js";
import {
  MAX_COMMIT_FILES,
  MIN_DEGREE,
  MIN_SHARED_COMMITS,
} from "../coupling/coupling.js";
import { MIN_CLIQUE_SHARE } from "../distant/cliques.js";
import { MIN_LOCAL_DISTANCE } from "../distant/distant-couplings.js";
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
import { MIN_VOLATILITY_RATIO } from "../stability/dependency-direction.js";
import {
  MIN_FAN_IN,
  MIN_INTERFACE_CHANGES,
} from "../stability/unstable-interfaces.js";
import {
  MAX_FILE_BYTES,
  MAX_MEAN_LINE_LENGTH,
} from "../universe/source-file.js";

/**
 * The limits an analysis applied; `couplingCommits` sets the floor of ranked
 * modules, `halfLifeDays` is the half-life of a change's weight (0: off).
 */
export const thresholdsFor = (couplingCommits: number, halfLifeDays: number) =>
  ({
    halfLifeDays,
    maxCommitFiles: MAX_COMMIT_FILES,
    hubMinBreadth: HUB_MIN_BREADTH,
    hubMinRevisions: HUB_MIN_REVISIONS,
    hubTopShare: HUB_TOP_SHARE,
    minModuleCommits: minModuleCommitsFor(couplingCommits),
    minLocalDistance: MIN_LOCAL_DISTANCE,
    minCliqueShare: MIN_CLIQUE_SHARE,
    minFanIn: MIN_FAN_IN,
    minInterfaceChanges: MIN_INTERFACE_CHANGES,
    minVolatilityRatio: MIN_VOLATILITY_RATIO,
    minHiddenProbability: MIN_HIDDEN_PROBABILITY,
    minCopySimilarity: MIN_COPY_SIMILARITY,
    minLeakage: MIN_LEAKAGE,
    minImplementationCommits: MIN_IMPLEMENTATION_COMMITS,
    minSharedCommits: MIN_SHARED_COMMITS,
    minDegree: MIN_DEGREE,
    ubiquitousShare: UBIQUITOUS_SHARE,
    ubiquitousMinCommits: UBIQUITOUS_MIN_COMMITS,
    maxMeanLineLength: MAX_MEAN_LINE_LENGTH,
    maxFileBytes: MAX_FILE_BYTES,
  }) satisfies Report["thresholds"];
