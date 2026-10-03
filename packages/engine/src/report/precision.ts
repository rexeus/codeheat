// Owns how many decimals the report's fractional values keep.

const FACTOR = 10 ** 4;

/**
 * Rounds a fractional report value (score, degree, probability, mean) to 4
 * decimals. Full float precision costs tokens and carries no information.
 * Round only what is emitted; rank and threshold decisions use exact values.
 */
export const roundReported = (value: number): number =>
  Math.round(value * FACTOR) / FACTOR;

/**
 * Rounds a weight sum (`weightedRevisions`, `weightedCommits`) to 4 decimals,
 * or to 4 significant digits where it is below 0.1, so a positive sum of
 * weights never rounds to 0: a file that only changed long ago still weighs
 * something. Zero stays 0.
 */
export const roundWeighted = (value: number): number => {
  if (value <= 0) {
    return 0;
  }
  const decimals = Math.max(4, 3 - Math.floor(Math.log10(value)));
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};
