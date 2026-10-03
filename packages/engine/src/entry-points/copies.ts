// Owns the entry points of kind `copies`: families of copies that change in lockstep.
import { MIN_SHARED_COMMITS } from "../coupling/coupling.js";
import type { CopyFamily } from "../report/copy-family.js";
import { evidenceOf } from "./candidate.js";
import type { Candidate } from "./candidate.js";
import { COPIES_MOVE, COPIES_VERDICT } from "./moves.js";

/**
 * The copy families with production code (never `testOnly`) that changed in
 * at least `MIN_SHARED_COMMITS` changes that touched every copy. The score is
 * `lockstep × activity`: `lockstep` is the share of the changes that touched
 * two or more copies that touched all of them, and `activity` is the share of
 * all counted changes (`changes`) that touched every copy: how often the same
 * edit had to be made in each copy. `territoryOf` maps a path to its finest
 * territory.
 */
export const copiesEntries = (
  families: ReadonlyArray<CopyFamily>,
  territoryOf: ReadonlyMap<string, string>,
  changes: number,
): ReadonlyArray<Candidate> =>
  families.flatMap((family): Array<Candidate> => {
    if (
      family.testOnly ||
      family.changesToAll < MIN_SHARED_COMMITS ||
      changes === 0
    ) {
      return [];
    }
    return [
      {
        kind: "copies",
        score:
          (family.changesToAll / family.sharedChanges) *
          (family.changesToAll / changes),
        territories: [
          ...new Set(
            family.files.flatMap((file) => territoryOf.get(file) ?? []),
          ),
        ].toSorted(),
        files: family.files,
        evidence: evidenceOf({
          files: family.files.length,
          sharedChanges: family.sharedChanges,
          changesToAll: family.changesToAll,
          similarity: family.similarity.min,
        }),
        verdict: COPIES_VERDICT,
        designMove: COPIES_MOVE,
      },
    ];
  });
