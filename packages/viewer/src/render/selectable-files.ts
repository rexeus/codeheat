import type { Report } from "@codeheat/engine";

import { listedHotspotPaths } from "../hotspots/overview-hotspots.js";
import type { PartnerIndex } from "../selection/partners.js";

/** Coupled files and the panel's hotspots stay selectable tiles when small files merge. */
export const selectableFiles = (
  { files }: Report,
  partnerIndex: PartnerIndex,
): Set<string> =>
  new Set([...partnerIndex.keys(), ...listedHotspotPaths(files)]);
