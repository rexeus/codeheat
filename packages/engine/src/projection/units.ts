// Owns rounding the analysis's values into the units of report v2.

/** A share of 0 to 1 as a percent, rounded to 1 decimal. */
export const percentOf = (share: number): number =>
  Math.round(share * 1000) / 10;

/** A share of 0 to 1, rounded to 2 decimals. */
export const shareOf = (value: number): number => Math.round(value * 100) / 100;

/** The UTC day of an ISO timestamp, `YYYY-MM-DD`. */
export const dayOf = (iso: string): string => iso.slice(0, 10);

/** Tenths of a percent in a share, the unit `percentsOf` hands out. */
const TENTHS = 1000;
/** The analysis rounds its shares to 4 decimals, so they are whole in this unit. */
const BASIS_POINTS = 10_000;

/**
 * The shares of a whole (`shares`, each of 0 to 1 with at most 4 decimals,
 * summing to about 1) as percents with 1 decimal that add up to the percent
 * of their sum: each is rounded down, and the tenths that rounding loses go
 * to the largest remainders, the first of equal ones first. Every percent
 * lies within 0.1 of its share, and no rounding makes the parts outgrow the
 * whole.
 */
export const percentsOf = (
  shares: ReadonlyArray<number>,
): ReadonlyArray<number> => {
  const points = shares.map((share) => Math.round(share * BASIS_POINTS));
  const perTenth = BASIS_POINTS / TENTHS;
  const floors = points.map((point) => Math.floor(point / perTenth));
  const total = Math.round(
    points.reduce((sum, point) => sum + point, 0) / perTenth,
  );
  const left = total - floors.reduce((sum, floor) => sum + floor, 0);
  const lucky = new Set(
    points
      .map((point, index) => ({ index, remainder: point % perTenth }))
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
