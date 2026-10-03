/** A 0..1 fraction as a whole percentage, e.g. `0.608` becomes `61%`. */
export const percent = (fraction: number): string =>
  `${Math.round(fraction * 100)}%`;

/** The calendar day (`YYYY-MM-DD`) of an ISO timestamp. */
export const day = (timestamp: string): string => timestamp.slice(0, 10);

/** A number with at most two decimals and no trailing zeros, e.g. `1.1809` becomes `1.18`. */
export const twoDecimals = (value: number): string =>
  String(Number(value.toFixed(2)));

/**
 * A sum of weights in few characters: whole from 9.95 up, one decimal from 1 up,
 * two significant figures above 0.01, `<0.01` for less, `0` for none.
 */
export const weightLabel = (weight: number): string => {
  if (weight === 0) {
    return "0";
  }
  if (weight >= 9.95) {
    return String(Math.round(weight));
  }
  if (weight >= 1) {
    return weight.toFixed(1);
  }
  return weight >= 0.01 ? String(Number(weight.toPrecision(2))) : "<0.01";
};

const DAYS_PER_YEAR = 365;
const DAYS_PER_MONTH = 30;
const DAYS_PER_WEEK = 7;

/** A half-life in days as the flag would spell it: `180` is `6m`, `365` is `1y`, `90` is `3m`, `10` is `10d`. */
const halfLifeLabel = (days: number): string => {
  if (days % DAYS_PER_YEAR === 0) {
    return `${days / DAYS_PER_YEAR}y`;
  }
  if (days % DAYS_PER_MONTH === 0) {
    return `${days / DAYS_PER_MONTH}m`;
  }
  return days % DAYS_PER_WEEK === 0 ? `${days / DAYS_PER_WEEK}w` : `${days}d`;
};

/** How the view's numbers weigh change: `unweighted` for a half-life of 0. */
export const weightingNote = (halfLifeDays: number): string =>
  halfLifeDays === 0
    ? "unweighted"
    : `weighted by recency, half-life ${halfLifeLabel(halfLifeDays)}`;
