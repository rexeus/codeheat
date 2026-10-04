// Owns the entry points of kind `clique`: territories that change as one unit
// across their boundaries.
import type { Clique } from "../report/clique.js";
import type { Territory } from "../report/territory.js";
import { evidenceOf } from "./candidate.js";
import type { Candidate } from "./candidate.js";
import type { EntryLimits } from "./limits.js";
import { CLIQUE_VERDICT, cliqueMove } from "./moves.js";

/** Shared changes at which a clique's evidence counts in full; fewer weigh in proportion. */
const FULL_EVIDENCE_CHANGES = 10;

/** A clique with at least this share of its territories in a better one is that unit seen again; only the better one is listed. */
const SAME_UNIT_OVERLAP = 0.5;

/** The share of the territories of `candidate` that `kept` has too. */
const overlap = (
  candidate: ReadonlyArray<string>,
  kept: ReadonlyArray<string>,
): number =>
  candidate.filter((id) => kept.includes(id)).length / candidate.length;

const scored = (
  cliques: ReadonlyArray<Clique>,
  byId: ReadonlyMap<string, Territory>,
  minHeatShare: number,
): ReadonlyArray<Candidate> =>
  cliques.flatMap((clique): Array<Candidate> => {
    const members = clique.modules.flatMap((id) => byId.get(id) ?? []);
    const heatShare = members.reduce((sum, { heatShare: own }) => sum + own, 0);
    if (members.length !== clique.modules.length || heatShare < minHeatShare) {
      return [];
    }
    return [
      {
        kind: "clique",
        score:
          heatShare *
          clique.weakestShare *
          Math.min(1, clique.sharedCommits / FULL_EVIDENCE_CHANGES),
        territories: clique.modules,
        files: [],
        evidence: evidenceOf({
          territories: members.length,
          heatShare,
          weakestShare: clique.weakestShare,
          sharedChanges: clique.sharedCommits,
        }),
        verdict: CLIQUE_VERDICT,
        designMove: cliqueMove(members.map(({ path }) => path)),
      },
    ];
  });

/**
 * The cliques among the territories at the recommended detail (see
 * `Clique`; the members are territory ids) whose members hold at least
 * `limits.minEntryHeatShare` of the heat together. The score is `heat of the members ×
 * weakest share × evidence`: the heat that moves as one unit, as tightly as
 * the weakest pair does, with `evidence` `min(1, shared changes / 10)` so that
 * a unit seen three times does not outrank one seen eleven times. A clique
 * with a member that is not a real territory is left out, and so is one that
 * has at least half of its territories in a better scored one.
 */
export const cliqueEntries = (
  cliques: ReadonlyArray<Clique>,
  byId: ReadonlyMap<string, Territory>,
  limits: EntryLimits,
): ReadonlyArray<Candidate> => {
  const kept: Array<Candidate> = [];
  for (const candidate of scored(
    cliques,
    byId,
    limits.minEntryHeatShare,
  ).toSorted((a, b) => b.score - a.score)) {
    if (
      kept.every(
        ({ territories }) =>
          overlap(candidate.territories, territories) < SAME_UNIT_OVERLAP,
      )
    ) {
      kept.push(candidate);
    }
  }
  return kept;
};
