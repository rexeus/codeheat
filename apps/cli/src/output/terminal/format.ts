/** A 0..1 fraction as a whole percentage, e.g. `0.608` becomes `61%`. */
export const percent = (fraction: number): string =>
  `${Math.round(fraction * 100)}%`;

/** The calendar day (`YYYY-MM-DD`) of an ISO timestamp. */
export const day = (timestamp: string): string => timestamp.slice(0, 10);
