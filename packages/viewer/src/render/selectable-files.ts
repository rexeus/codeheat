import type { Analysis } from "@codeheat/engine";

import { overviewHotspots } from "../hotspots/overview-hotspots.js";
import type { PartnerIndex } from "../selection/partners.js";

/** Coupled files and the panel's hotspots stay selectable tiles when small files merge. */
export const selectableFiles = (
  { files }: Analysis,
  partnerIndex: PartnerIndex,
): Set<string> =>
  new Set([
    ...partnerIndex.keys(),
    ...overviewHotspots(files).map(({ path }) => path),
  ]);
