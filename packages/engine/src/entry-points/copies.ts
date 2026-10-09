// Owns the entry points of kind `copies`: families of copies that change in lockstep.
import type { CopyFamily } from "../model/copy-family.js";
import { evidenceOf } from "./candidate.js";
import type { Candidate } from "./candidate.js";
import type { FileHeat } from "./file-heat.js";
import type { EntryLimits } from "./limits.js";
import { COPIES_MOVE, COPIES_VERDICT } from "./moves.js";

/**
 * The copy families in which at least
 * `limits.minEntryChanges` changes touched every copy. The score is the share
 * of all the production code's heat that the copies hold (`heat.share`) times `lockstep`, the share of the changes that touched two or more
 * copies that touched all of them. `territoryOf` maps a path to its finest
 * territory.
 */
export const copiesEntries = (
  families: ReadonlyArray<CopyFamily>,
  territoryOf: ReadonlyMap<string, string>,
  heat: FileHeat,
  limits: EntryLimits,
): ReadonlyArray<Candidate> =>
  families.flatMap((family): Array<Candidate> => {
    if (family.changesToAll < limits.minEntryChanges) {
      return [];
    }
    const heatShare = heat.share(family.files);
    return [
      {
        kind: "copies",
        score: heatShare * (family.changesToAll / family.sharedChanges),
        territories: [
          ...new Set(
            family.files.flatMap((file) => territoryOf.get(file) ?? []),
          ),
        ].toSorted(),
        files: family.files,
        evidence: evidenceOf({
          heatShare,
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
