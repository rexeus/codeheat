// Owns how many decimals the report's fractional values keep.

const FACTOR = 10 ** 4;

/**
 * Rounds a fractional report value (score, degree, probability, mean) to 4
 * decimals. Full float precision costs tokens and carries no information.
 * Round only what is emitted; rank and threshold decisions use exact values,
 * except where the report states both the value and the decision: the
 * verdict's level is decided on the shares it reports (see `judgeVerdict`).
 */
export const roundReported = (value: number): number =>
  Math.round(value * FACTOR) / FACTOR;
