// Owns rounding the analysis's values into the units of report v2.

/** A share of 0 to 1 as a percent, rounded to 1 decimal. */
export const percentOf = (share: number): number =>
  Math.round(share * 1000) / 10;

/** A share of 0 to 1, rounded to 2 decimals. */
export const shareOf = (value: number): number => Math.round(value * 100) / 100;

/** The UTC day of an ISO timestamp, `YYYY-MM-DD`. */
export const dayOf = (iso: string): string => iso.slice(0, 10);

/** The analysis rounds its shares to 4 decimals, so they are whole in this unit. */
const BASIS_POINTS = 10_000;
/** Tenths of a percent in all of a whole, the unit `percentsOf` hands out. */
const WHOLE = 1000;

/**
 * A share of 0 to 1 (at most 4 decimals) as a percent rounded down to 1
 * decimal, so a percent beside a judgement never reaches the cut point the
 * share stayed below: 0.1995 is 19.9, not 20.
 */
export const percentDownOf = (share: number): number =>
  Math.floor(Math.round(share * BASIS_POINTS) / 10) / 10;

/**
 * The parts of one whole (`shares`, each of 0 to 1 with at most 4 decimals,
 * summing to about 1, as the territories of one detail split all the heat)
 * as percents with 1 decimal that add up to exactly 100: each share is
 * scaled to their sum and rounded down, and the tenths that rounding loses go
 * to the largest remainders, the first of equal ones first. Every percent
 * lies within 0.1 of its scaled share. All are 0 when no share is.
 */
export const percentsOf = (
  shares: ReadonlyArray<number>,
): ReadonlyArray<number> => {
  const points = shares.map((share) => Math.round(share * BASIS_POINTS));
  const sum = points.reduce((total, point) => total + point, 0);
  if (sum === 0) {
    return points.map(() => 0);
  }
  const floors = points.map((point) => Math.floor((point * WHOLE) / sum));
  const left = WHOLE - floors.reduce((total, floor) => total + floor, 0);
  const lucky = new Set(
    points
      .map((point, index) => ({ index, remainder: (point * WHOLE) % sum }))
      .toSorted(
        (one, other) =>
          other.remainder - one.remainder || one.index - other.index,
      )
      .slice(0, left)
      .map(({ index }) => index),
  );
  return floors.map(
    (floor, index) => (floor + (lucky.has(index) ? 1 : 0)) / 10,
  );
};
