// Owns the basis of report v2: the limits behind the answer under their v2
// names, and what the counts leave out.
import type { Analysis } from "../model/analysis.js";
import type { Basis } from "../report/basis.js";
import { percentOf } from "./units.js";

/** The limits the answer applies, under their v2 names; the shares of all the heat as percents. */
const thresholdsOf = (
  thresholds: Analysis["thresholds"],
): Basis["thresholds"] => ({
  leaksAtStays: thresholds.maxEntryContainment,
  judgedFromChanges: thresholds.minModuleCommits,
  mixedFromLeakingHeat: percentOf(thresholds.minMixedLeakShare),
  strainedFromLeakingHeat: percentOf(thresholds.minStrainedLeakShare),
  judgedHeatNeeded: percentOf(thresholds.minVerdictCoverage),
  pairFromChanges: thresholds.minSharedCommits,
  pairFromStrength: thresholds.minDegree,
  maxChangeFiles: thresholds.maxCommitFiles,
  thinBelowChanges: thresholds.thinBelowChanges,
  thinBelowAreas: thresholds.thinBelowAreas,
});

/**
 * The basis of `analysis` with `rest`, the areas the report does not list:
 * mechanical commits of every kind, the logical changes over
 * `maxCommitFiles` files, and the files the universe leaves out as generated.
 */
export const basisOf = (
  analysis: Pick<
    Analysis,
    "thresholds" | "mechanicalCommits" | "logicalChanges" | "window" | "totals"
  >,
  rest: Basis["rest"],
): Basis => ({
  thresholds: thresholdsOf(analysis.thresholds),
  excluded: {
    mechanicalCommits: Object.values(analysis.mechanicalCommits).reduce(
      (sum, count) => sum + count,
      0,
    ),
    largeChanges:
      analysis.logicalChanges.count - analysis.window.couplingCommits,
    generated: analysis.totals.generated,
  },
  rest,
});
