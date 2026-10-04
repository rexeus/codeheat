// Owns the entry points of kind `boundary`: territories that carry much of the
// heat and whose changes keep reaching into other territories.
import { evidenceOf } from "./candidate.js";
import type { Candidate } from "./candidate.js";
import { isChronic } from "./judged-territories.js";
import type { Judged } from "./judged-territories.js";
import type { EntryLimits } from "./limits.js";
import { boundaryMove, boundaryVerdict } from "./moves.js";

/** How much more a territory ranks when most of its heat is chronic. */
const CHRONIC_BOOST = 1.5;

/**
 * Whether the territory has changes to judge, keeps at most
 * `maxEntryContainment` of them inside, holds at least `minEntryHeatShare` of
 * the heat, and has a leak target: a `fit.partner` that shares at least
 * `minSharedCommits` changes with it (the partner is null below that, and for
 * a territory under `minModuleCommits` changes, which is never judged).
 */
const leaks = ({ fit, codeHeatShare }: Judged, limits: EntryLimits): boolean =>
  fit.partner !== null &&
  fit.containment !== null &&
  fit.containment <= limits.maxEntryContainment &&
  codeHeatShare >= limits.minEntryHeatShare;

/**
 * The territories whose boundary does not hold: at most
 * `limits.maxEntryContainment` of their changes stay inside and they hold at
 * least `limits.minEntryHeatShare` of the production code's heat, and some
 * other territory shares changes with them (see `leaks`): a verdict on a
 * boundary needs evidence of where it leaks to. The score is
 * `codeHeatShare × (1 − containment) × (chronic ? 1.5 : 1) × (1 + fix share)`:
 * the design's heat that leaks, more when it is the long-lived kind and when it
 * is spent on fixes. The base is the production code's heat (`Judged.codeHeatShare`):
 * tests are change effort but not design, so a territory made of test code
 * does not rank; `Territory.heatShare`, which counts them, stays in the
 * evidence. A territory is chronic when most of its code's heat is in chronic
 * hotspots (see `isChronic`); the fix share is 0 where subjects do not tell.
 */
export const boundaryEntries = (
  judged: ReadonlyArray<Judged>,
  pathOf: ReadonlyMap<string, string>,
  limits: EntryLimits,
): ReadonlyArray<Candidate> =>
  judged.flatMap((territory): Array<Candidate> => {
    const { fit, heatShare, codeHeatShare } = territory;
    if (!leaks(territory, limits) || fit.partner === null) {
      return [];
    }
    const containment = fit.containment ?? 1;
    return [
      {
        kind: "boundary",
        score:
          codeHeatShare *
          (1 - containment) *
          (isChronic(fit, limits.minEntryChronicShare) ? CHRONIC_BOOST : 1) *
          (1 + (fit.fixDensity?.share ?? 0)),
        territories: [territory.id],
        files: [],
        evidence: evidenceOf({
          codeHeatShare,
          heatShare,
          containment,
          changes: territory.changes,
          chronicShare: fit.chronicShare,
          fixShare: fit.fixDensity?.share,
          distantPairs: fit.distantPairs,
          hiddenPairs: fit.hiddenPairs,
          cliques: fit.cliques,
          partnerShare: fit.partner.share,
        }),
        verdict: boundaryVerdict(fit.erosion?.verdict === "eroding"),
        designMove: boundaryMove(
          territory.path,
          pathOf.get(fit.partner.territory) ?? fit.partner.territory,
        ),
      },
    ];
  });
