// Owns the entry points of kind `coupling`: files in different territories that
// keep changing together although no import links them.
import { isJudgeablePair } from "../distant/distant-couplings.js";
import type { Coupling } from "../report/report.js";
import { evidenceOf } from "./candidate.js";
import type { Candidate } from "./candidate.js";
import { COUPLING_VERDICT, couplingMove } from "./moves.js";

/** Fewest shared changes at which a hidden coupling is worth an entry. */
const MIN_SHARED_CHANGES = 5;

/**
 * The hidden couplings (see `Coupling.imports`: `none`; a coupling whose
 * relation is unknown never qualifies) between files that lie in different
 * territories of `areaOfFile` (the territory each file belongs to at the
 * recommended detail; a file without one, such as a contract, is left out) and
 * are judgeable (see `isJudgeablePair`: no test code, no two contract files),
 * with at least `MIN_SHARED_CHANGES` shared changes. The score is `degree ×
 * activity`: `degree` is how tightly the two change together (see
 * `Coupling.degree`) and `activity` the share of all counted changes
 * (`changes`) that touched both. Of several pairs between the same two
 * territories, only the best is listed. `territoryOf` maps a path to its
 * finest territory, for the entry's `territories`.
 */
export const couplingEntries = (
  couplings: ReadonlyArray<Coupling>,
  areaOfFile: ReadonlyMap<string, string>,
  territoryOf: ReadonlyMap<string, string>,
  changes: number,
): ReadonlyArray<Candidate> => {
  const best = new Map<string, Candidate>();
  for (const coupling of couplings) {
    const areas = [areaOfFile.get(coupling.a), areaOfFile.get(coupling.b)];
    const [first, second] = areas;
    if (
      first === undefined ||
      second === undefined ||
      first === second ||
      coupling.imports !== "none" ||
      coupling.sharedCommits < MIN_SHARED_CHANGES ||
      changes === 0 ||
      !isJudgeablePair(coupling)
    ) {
      continue;
    }
    const candidate: Candidate = {
      kind: "coupling",
      score: coupling.degree * (coupling.sharedCommits / changes),
      territories: [
        ...new Set(
          [coupling.a, coupling.b].flatMap(
            (file) => territoryOf.get(file) ?? [],
          ),
        ),
      ].toSorted(),
      files: [coupling.a, coupling.b],
      evidence: evidenceOf({
        sharedChanges: coupling.sharedCommits,
        degree: coupling.degree,
        distance: coupling.distance,
      }),
      verdict: COUPLING_VERDICT,
      designMove: couplingMove(coupling.a, coupling.b),
    };
    const key = [first, second].toSorted().join("\n");
    const known = best.get(key);
    if (known === undefined || candidate.score > known.score) {
      best.set(key, candidate);
    }
  }
  return [...best.values()];
};
