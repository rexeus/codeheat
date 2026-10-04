// Owns the entry points of kind `coupling`: files in different territories that
// keep changing together although no import links them.
import { isJudgeablePair } from "../distant/distant-couplings.js";
import type { Coupling } from "../report/report.js";
import { evidenceOf } from "./candidate.js";
import type { Candidate } from "./candidate.js";
import type { FileHeat } from "./file-heat.js";
import type { EntryLimits } from "./limits.js";
import { COUPLING_VERDICT, couplingMove } from "./moves.js";

/**
 * The hidden couplings (see `Coupling.imports`: `none`; a coupling whose
 * relation is unknown never qualifies) between files that lie in different
 * territories of `places.areaOfFile` (the territory each file belongs to at the
 * recommended detail; a file without one, such as a contract, is left out) and
 * are judgeable (see `isJudgeablePair`: no test code, no two contract files),
 * with at least `limits.minEntryCouplingChanges` shared changes. The score is
 * the share of all the heat that the two files hold (`heat.share`) times `Coupling.degree`, how tightly the two change
 * together. Of several pairs between the same two territories, only the best
 * is listed. `places.territoryOf` maps a path to its finest territory, for the
 * entry's `territories`.
 */
export const couplingEntries = (
  couplings: ReadonlyArray<Coupling>,
  places: {
    readonly areaOfFile: ReadonlyMap<string, string>;
    readonly territoryOf: ReadonlyMap<string, string>;
  },
  heat: FileHeat,
  limits: EntryLimits,
): ReadonlyArray<Candidate> => {
  const best = new Map<string, Candidate>();
  for (const coupling of couplings) {
    const first = places.areaOfFile.get(coupling.a);
    const second = places.areaOfFile.get(coupling.b);
    if (
      first === undefined ||
      second === undefined ||
      first === second ||
      coupling.imports !== "none" ||
      coupling.sharedCommits < limits.minEntryCouplingChanges ||
      !isJudgeablePair(coupling)
    ) {
      continue;
    }
    const heatShare = heat.share([coupling.a, coupling.b]);
    const candidate: Candidate = {
      kind: "coupling",
      score: heatShare * coupling.degree,
      territories: [
        ...new Set(
          [coupling.a, coupling.b].flatMap(
            (file) => places.territoryOf.get(file) ?? [],
          ),
        ),
      ].toSorted(),
      files: [coupling.a, coupling.b],
      evidence: evidenceOf({
        heatShare,
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
