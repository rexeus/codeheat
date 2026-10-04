// Owns which files the map's side panel lists as its top hotspots: production
// code unless the reader asks for test code too.
import type { FileStats } from "@codeheat/engine";

/** Hotspots the overview lists; they always stay individual tiles. */
const OVERVIEW_HOTSPOTS = 10;

/** The hotspots the overview lists, and whether the reader can change what they cover. */
export type OverviewHotspots = {
  /** At most `OVERVIEW_HOTSPOTS` files, hottest first. */
  readonly files: readonly FileStats[];
  /** The list covers test code as well as production code. */
  readonly includesTests: boolean;
  /** The report has both kinds of file, so including test code makes a difference. */
  readonly toggleable: boolean;
};

/**
 * The top hotspots of `hottestFirst` (the report's order). Test code is left
 * out unless `includeTests` asks for it, or unless the report has nothing else
 * to rank; the list then says so through `includesTests`.
 */
export const overviewHotspots = (
  hottestFirst: readonly FileStats[],
  includeTests: boolean,
): OverviewHotspots => {
  const production = hottestFirst.filter(({ test }) => !test);
  const toggleable =
    production.length > 0 && production.length < hottestFirst.length;
  const includesTests = includeTests || production.length === 0;
  return {
    files: (includesTests ? hottestFirst : production).slice(
      0,
      OVERVIEW_HOTSPOTS,
    ),
    includesTests,
    toggleable,
  };
};

/** Every file either list of the overview can show, so that none of them merges into a bucket tile. */
export const listedHotspotPaths = (
  hottestFirst: readonly FileStats[],
): string[] => [
  ...new Set(
    [true, false].flatMap((includeTests) =>
      overviewHotspots(hottestFirst, includeTests).files.map(
        ({ path }) => path,
      ),
    ),
  ),
];
