// Owns which files the map's side panel lists as its top hotspots.
import type { FileStats } from "@codeheat/engine";

/** Hotspots the overview lists; they always stay individual tiles. */
const OVERVIEW_HOTSPOTS = 10;

/** The top hotspots of `hottestFirst` (the report's order): at most `OVERVIEW_HOTSPOTS` files, hottest first. */
export const overviewHotspots = (
  hottestFirst: readonly FileStats[],
): readonly FileStats[] => hottestFirst.slice(0, OVERVIEW_HOTSPOTS);
