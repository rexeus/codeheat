// Owns how a module's cohesion becomes a color step. Unlike heat, which ranks
// files against each other, cohesion is a share with a meaning of its own
// ("62 % of changes stay inside"), so the bands are fixed.

/** Steps of the cohesion ramp: 0 is "no data", 1..6 run from low cohesion to high. */
export const COHESION_STEP_COUNT = 7;

/** Exclusive upper bounds of steps 1..5; every cohesion from the last bound up is step 6. */
const UPPER_BOUNDS = [0.25, 0.4, 0.55, 0.7, 0.85] as const;

/**
 * The step of `cohesion`: 0 for `null` (a module without counted commits has
 * no data, which is not perfect cohesion), otherwise 1 (the least cohesive
 * band, drawn as the attention color) to 6 (the most cohesive, drawn calm).
 */
export const cohesionStep = (cohesion: number | null): number => {
  if (cohesion === null) {
    return 0;
  }
  const band = UPPER_BOUNDS.findIndex((bound) => cohesion < bound);
  return band === -1 ? UPPER_BOUNDS.length + 1 : band + 1;
};
