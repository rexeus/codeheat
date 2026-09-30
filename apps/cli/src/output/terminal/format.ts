/** A 0..1 fraction as a whole percentage, e.g. `0.608` becomes `61%`. */
export const percent = (fraction: number): string =>
  `${Math.round(fraction * 100)}%`;

/** The calendar day (`YYYY-MM-DD`) of an ISO timestamp. */
export const day = (timestamp: string): string => timestamp.slice(0, 10);

/** A number with at most two decimals and no trailing zeros, e.g. `1.1809` becomes `1.18`. */
export const twoDecimals = (value: number): string =>
  String(Number(value.toFixed(2)));
