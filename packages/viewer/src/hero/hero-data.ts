import type { Report } from "@codeheat/engine";

import { entryViewsOf, noEntriesNote } from "../entry-points/entry-views.js";
import type { EntryView } from "../entry-points/entry-views.js";
import { fitTilesOf } from "../fit-map/fit-tiles.js";
import type { FitTile } from "../fit-map/fit-tiles.js";
import { indexTerritories } from "../territories/territory-index.js";
import { deriveVerdict } from "../verdict/derive-verdict.js";
import type { Verdict } from "../verdict/derive-verdict.js";

/** Everything the first screen and "Where to start" show, derived from the report once. */
export type HeroData = {
  readonly verdict: Verdict;
  /** One tile per territory at the recommended detail; empty when the report has none. */
  readonly tiles: readonly FitTile[];
  /** The places to start, best first; empty when the report has none. */
  readonly entries: readonly EntryView[];
  /** What to say in place of the places to start when there are none. */
  readonly noEntries: string;
};

export const heroDataOf = (report: Report): HeroData => {
  const territories = indexTerritories(report.territories);
  const entries = entryViewsOf(report, territories);
  return {
    verdict: deriveVerdict(report, territories),
    tiles: fitTilesOf(territories, entries, report.thresholds),
    entries,
    noEntries: noEntriesNote(report),
  };
};
