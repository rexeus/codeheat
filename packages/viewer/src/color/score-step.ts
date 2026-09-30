/** Steps of the heat ramp: 0 is "no score", 1..8 run from cool to hot. */
export const HEAT_STEP_COUNT = 9;

const RAMP_STEPS = HEAT_STEP_COUNT - 1;

/**
 * Buckets a hotspot score (0..1) into a heat step. A score of 0 is its own
 * step so untouched or trivial files read as neutral rather than faintly hot.
 * The stylesheet owns the colors of each step for light and dark appearance.
 */
export const scoreStep = (score: number): number =>
  score <= 0 ? 0 : Math.min(RAMP_STEPS, 1 + Math.floor(score * RAMP_STEPS));
