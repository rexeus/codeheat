// Owns how a score becomes a heat step: by its standing among the report's files.
// Real scores bunch up (0.3..0.8 is common), so equal-width buckets painted
// almost every tile the same orange; percentile bands keep the hottest few distinct.

/** Steps of the heat ramp: 0 is "no score", 1..8 run from cool to hot. */
export const HEAT_STEP_COUNT = 9;

/** Share of scored files hotter than a file, per step from hottest down: step 8 is the top 2 %. */
const BANDS = [0.02, 0.05, 0.1, 0.2, 0.35, 0.5, 0.7] as const;

export type HeatScale = (score: number) => number;

/** The number of values in `descending` that are greater than `score`. */
const countGreater = (descending: readonly number[], score: number): number => {
  let [low, high] = [0, descending.length];
  while (low < high) {
    const middle = (low + high) >>> 1;
    if ((descending[middle] ?? 0) > score) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }
  return low;
};

/**
 * A scale over `scores` (every file's score): 0 stays the neutral step, and
 * any other score gets the band its share of hotter files falls into.
 * The stylesheet owns the colors of each step for light and dark appearance.
 */
export const makeHeatScale = (scores: readonly number[]): HeatScale => {
  const scored = scores.filter((score) => score > 0).toSorted((a, b) => b - a);
  return (score) => {
    if (score <= 0 || scored.length === 0) {
      return 0;
    }
    const share = countGreater(scored, score) / scored.length;
    const band = BANDS.findIndex((limit) => share < limit);
    return band === -1 ? 1 : HEAT_STEP_COUNT - 1 - band;
  };
};
