const counts = new Intl.NumberFormat("en");

export const formatCount = (value: number): string => counts.format(value);

/** The calendar day of an ISO timestamp, as `YYYY-MM-DD`. */
export const formatDay = (timestamp: string): string => timestamp.slice(0, 10);

export const formatScore = (score: number): string => score.toFixed(2);

export const formatPercent = (share: number): string =>
  `${Math.round(share * 100)}%`;

/** Splits a POSIX path into its directory (with trailing slash) and file name. */
export const splitPath = (path: string): { dir: string; name: string } => {
  const cut = path.lastIndexOf("/") + 1;
  return { dir: path.slice(0, cut), name: path.slice(cut) };
};
