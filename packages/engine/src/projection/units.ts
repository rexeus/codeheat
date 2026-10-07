// Owns rounding the analysis's values into the units of report v2.

/** A share of 0 to 1 as a percent, rounded to 1 decimal. */
export const percentOf = (share: number): number =>
  Math.round(share * 1000) / 10;

/** The UTC day of an ISO timestamp, `YYYY-MM-DD`. */
export const dayOf = (iso: string): string => iso.slice(0, 10);
