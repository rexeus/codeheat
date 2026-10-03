// Owns the entry points of kind `boundary`: territories that carry much of the
// heat and whose changes keep reaching into other territories.
import { evidenceOf } from "./candidate.js";
import type { Candidate } from "./candidate.js";
import { isChronic } from "./judged-territories.js";
import type { Judged } from "./judged-territories.js";
import { boundaryMove, boundaryVerdict } from "./moves.js";

/** A territory keeps its boundary when more than this share of its changes stay inside it. */
const MAX_CONTAINMENT = 0.75;

/** A territory with less of the repository's heat is not worth starting with. */
export const MIN_HEAT_SHARE = 0.02;

/** How much more a territory ranks when most of its heat is chronic. */
const CHRONIC_BOOST = 1.5;

/** Whether the territory has changes to judge, keeps at most `MAX_CONTAINMENT` of them inside, and holds at least `MIN_HEAT_SHARE` of the heat. */
const leaks = ({ fit, heatShare }: Judged): boolean =>
  fit.containment !== null &&
  fit.containment <= MAX_CONTAINMENT &&
  heatShare >= MIN_HEAT_SHARE;

/**
 * The territories whose boundary does not hold: at most `MAX_CONTAINMENT` of
 * their changes stay inside and they hold at least `MIN_HEAT_SHARE` of the
 * heat. The score is `heatShare × (1 − containment) × (chronic ? 1.5 : 1) ×
 * (1 + fix share)`: the heat that leaks, more when it is the long-lived kind
 * and when it is spent on fixes. A territory is chronic when most of its heat
 * is in chronic hotspots (see `isChronic`); the fix share is 0 where subjects
 * do not tell.
 */
export const boundaryEntries = (
  judged: ReadonlyArray<Judged>,
  pathOf: ReadonlyMap<string, string>,
): ReadonlyArray<Candidate> =>
  judged.flatMap((territory): Array<Candidate> => {
    const { fit, heatShare } = territory;
    if (!leaks(territory)) {
      return [];
    }
    const containment = fit.containment ?? 1;
    return [
      {
        kind: "boundary",
        score:
          heatShare *
          (1 - containment) *
          (isChronic(fit) ? CHRONIC_BOOST : 1) *
          (1 + (fit.fixDensity?.share ?? 0)),
        territories: [territory.id],
        files: [],
        evidence: evidenceOf({
          heatShare,
          containment,
          changes: territory.changes,
          chronicShare: fit.chronicShare,
          fixShare: fit.fixDensity?.share,
          distantPairs: fit.distantPairs,
          hiddenPairs: fit.hiddenPairs,
          cliques: fit.cliques,
          partnerShare: fit.partner?.share,
        }),
        verdict: boundaryVerdict(fit.erosion?.verdict === "eroding"),
        designMove: boundaryMove(
          territory.path,
          pathOf.get(fit.partner?.territory ?? "") ?? null,
        ),
      },
    ];
  });
