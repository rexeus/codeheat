// Owns the entry points of kind `hotspot`: territories whose heat is mostly in
// chronic hotspot files.
import type { FileStats } from "../report/report.js";
import { MIN_HEAT_SHARE } from "./boundary.js";
import { evidenceOf } from "./candidate.js";
import type { Candidate } from "./candidate.js";
import { isChronic } from "./judged-territories.js";
import type { Judged } from "./judged-territories.js";
import { HOTSPOT_VERDICT, hotspotMove } from "./moves.js";

/** An entry names at most this many of the hotspots. */
const MAX_FILES = 5;

/**
 * The territories that are chronic (most of their heat is in chronic
 * hotspots, see `isChronic`) and hold at least `MIN_HEAT_SHARE` of the heat.
 * The score is `heatShare × chronicShare × (1 + fix share)`: the share of all
 * the heat that sits in long-lived hotspots, more when it is spent on fixes.
 * The entry names up to five of the territory's chronic hotspots, the highest
 * scored first; `chainOf` gives the territory a file lies in and its ancestors.
 */
export const hotspotEntries = (
  judged: ReadonlyArray<Judged>,
  files: ReadonlyArray<FileStats>,
  chainOf: (id: string) => ReadonlySet<string>,
): ReadonlyArray<Candidate> =>
  judged.flatMap((territory): Array<Candidate> => {
    const { fit, heatShare } = territory;
    if (!isChronic(fit) || heatShare < MIN_HEAT_SHARE) {
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
    return [
      {
        kind: "hotspot",
        score:
          heatShare * fit.chronicShare * (1 + (fit.fixDensity?.share ?? 0)),
        territories: [territory.id],
        files: hotspots
          .slice(0, MAX_FILES)
          .map(({ path }) => path)
          .toSorted(),
        evidence: evidenceOf({
          heatShare,
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
