// Owns the limits of the territory-level findings, reported under
// `Analysis.thresholds`: the entry point gates, the size of the territory
// matrix, and the cut points and evidence limits of the verdict.
import { ENTRY_THRESHOLDS } from "../entry-points/limits.js";
import { MAX_COUPLED_TERRITORIES } from "../territory-coupling/territory-pairs.js";
import { THIN_BELOW_AREAS, THIN_BELOW_CHANGES } from "../verdict/evidence.js";
import {
  MIN_MIXED_LEAK_SHARE,
  MIN_STRAINED_LEAK_SHARE,
  MIN_VERDICT_COVERAGE,
} from "../verdict/judge-verdict.js";

export const TERRITORY_THRESHOLDS = {
  ...ENTRY_THRESHOLDS,
  maxCoupledTerritories: MAX_COUPLED_TERRITORIES,
  minVerdictCoverage: MIN_VERDICT_COVERAGE,
  minMixedLeakShare: MIN_MIXED_LEAK_SHARE,
  minStrainedLeakShare: MIN_STRAINED_LEAK_SHARE,
  thinBelowChanges: THIN_BELOW_CHANGES,
  thinBelowAreas: THIN_BELOW_AREAS,
};
