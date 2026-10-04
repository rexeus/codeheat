// Owns the entry points of kind `hotspot`: territories whose heat is mostly in
// chronic hotspot files.
import type { FileStats } from "../report/report.js";
import type { Territory } from "../report/territory.js";
import { chainsOf } from "./ancestry.js";
import { evidenceOf } from "./candidate.js";
import type { Candidate } from "./candidate.js";
import type { FileHeat } from "./file-heat.js";
import { isChronic } from "./judged-territories.js";
import type { Judged } from "./judged-territories.js";
import type { EntryLimits } from "./limits.js";
import { HOTSPOT_VERDICT, hotspotMove } from "./moves.js";

/** What the hotspots of a territory are found among. */
export type HotspotPlaces = {
  readonly files: ReadonlyArray<FileStats>;
  /** The territory tree, to find the files below a territory. */
  readonly nodes: ReadonlyArray<Pick<Territory, "id" | "parent">>;
  readonly heat: FileHeat;
};

/** An entry names at most this many of the hotspots. */
const MAX_FILES = 5;

/**
 * The territories that are chronic (at least `limits.minEntryChronicShare` of
 * their code's heat is in chronic hotspots, see `isChronic`) and hold at least
 * `limits.minEntryHeatShare` of the production code's heat. The score is the
 * share of all the production code's heat that sits in the territory's chronic
 * hotspots (`heat.share` of their paths), more when it is spent on fixes
 * (`× (1 + fix share)`). The entry names up to
 * five of the chronic hotspots, the hottest (highest scored) first.
 */
export const hotspotEntries = (
  judged: ReadonlyArray<Judged>,
  { files, nodes, heat }: HotspotPlaces,
  limits: EntryLimits,
): ReadonlyArray<Candidate> => {
  const chainOf = chainsOf(nodes);
  return judged.flatMap((territory): Array<Candidate> => {
    const { fit, codeHeatShare } = territory;
    if (
      !isChronic(fit, limits.minEntryChronicShare) ||
      codeHeatShare < limits.minEntryHeatShare
    ) {
      return [];
    }
    const hotspots = files
      .filter(
        (file) =>
          !file.test &&
          file.heat?.kind === "chronic" &&
          chainOf(file.territory).has(territory.id),
      )
      .toSorted((a, b) => b.score - a.score || a.rank - b.rank);
    const chronicHeatShare = heat.share(hotspots.map(({ path }) => path));
    return [
      {
        kind: "hotspot",
        score: chronicHeatShare * (1 + (fit.fixDensity?.share ?? 0)),
        territories: [territory.id],
        files: hotspots.slice(0, MAX_FILES).map(({ path }) => path),
        evidence: evidenceOf({
          chronicHeatShare,
          chronicShare: fit.chronicShare,
          chronicFiles: fit.chronicFiles,
          containment: fit.containment,
          fixShare: fit.fixDensity?.share,
        }),
        verdict: HOTSPOT_VERDICT,
        designMove: hotspotMove(
          hotspots.slice(0, MAX_FILES).map(({ path }) => path),
        ),
      },
    ];
  });
};
