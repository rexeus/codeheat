import type { Report } from "@codeheat/engine";

import type { HeroData } from "../hero/hero-data.js";
import { listedHotspotPaths } from "../hotspots/overview-hotspots.js";
import type { PartnerIndex } from "../selection/partners.js";

/** Coupled files, the panel's hotspots, and the files places to start name stay selectable tiles when small files merge. */
export const selectableFiles = (
  { files }: Report,
  partnerIndex: PartnerIndex,
  { entries }: HeroData,
): Set<string> =>
  new Set([
    ...partnerIndex.keys(),
    ...listedHotspotPaths(files),
    ...entries.flatMap((entry) => entry.files),
  ]);
