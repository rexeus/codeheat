// Owns how a change in score becomes a color step on a diverging scale.
// Scores are normalized within each window, so a delta is a shift in standing
// among the files, not a change in raw revisions; the bands are fixed so a
// delta of 0.3 looks the same in every report.
import type { FileStats } from "@codeheat/engine";

/** Steps of the change ramp: 0 is "no data", 1..7 run from cooler through unchanged (4) to warmer. */
export const CHANGE_STEP_COUNT = 8;

/** The step that means "no meaningful change", between the cooler steps 1..3 and the warmer steps 5..7. */
const UNCHANGED_STEP = 4;

/** Exclusive upper bounds of the distance from "unchanged" for the weak, medium, and strong steps. */
const UPPER_BOUNDS = [0.02, 0.1, 0.25] as const;

/**
 * The step of a score change: 0 for `null` (no comparison data), 4 for a
 * change within 0.02, then three steps per side, cooler (1 strongest) for a
 * drop and warmer (7 strongest) for a rise. Cooler and warmer follow the
 * heat colors: a file that got hotter moves up the warm side.
 */
export const changeStep = (delta: number | null): number => {
  if (delta === null) {
    return 0;
  }
  const band = UPPER_BOUNDS.findIndex((bound) => Math.abs(delta) < bound);
  const distance = band === -1 ? UPPER_BOUNDS.length : band;
  return delta < 0 ? UNCHANGED_STEP - distance : UNCHANGED_STEP + distance;
};

/**
 * The score change a file is colored by: `null` without comparison data and
 * for a file that was not active before, whose change is its whole score
 * rather than warming.
 */
export const comparableChange = (trend: FileStats["trend"]): number | null =>
  trend === null || trend.newlyActive ? null : trend.scoreDelta;

/** The largest rise and the largest drop among the files merged into one tile; each is 0 when no file moved that way. */
export type TileChange = {
  readonly rise: number;
  readonly drop: number;
};

/**
 * The change a merged tile is colored by: whichever of its largest rise and
 * largest drop is bigger in absolute terms, so a strong cooling is not hidden
 * behind a weak warming. A tie goes to the rise.
 */
export const dominantChange = ({ rise, drop }: TileChange): number =>
  Math.abs(drop) > Math.abs(rise) ? drop : rise;
