// Owns how many decimals the report's fractional values keep.

const FACTOR = 10 ** 4;

/**
 * Rounds a fractional report value (score, degree, probability, mean) to 4
 * decimals. Full float precision costs tokens and carries no information.
 * Round only what is emitted; rank and threshold decisions use exact values.
 */
export const roundReported = (value: number): number =>
  Math.round(value * FACTOR) / FACTOR;
