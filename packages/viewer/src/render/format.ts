import type { FileStats } from "@codeheat/engine";

const counts = new Intl.NumberFormat("en");

export const formatCount = (value: number): string => counts.format(value);

/** A count with the noun in the number it needs: `1 territory`, `2 territories`. */
export const plural = (count: number, one: string, many: string): string =>
  `${formatCount(count)} ${count === 1 ? one : many}`;

/** The calendar day of an ISO timestamp, as `YYYY-MM-DD`. */
export const formatDay = (timestamp: string): string => timestamp.slice(0, 10);

const ratios = new Intl.NumberFormat("en", { maximumFractionDigits: 2 });

/** A ratio with at most two decimals and thousands separators, e.g. `1234.5678` as `1,234.57`. */
export const formatRatio = (value: number): string => ratios.format(value);

export const formatScore = (score: number): string => score.toFixed(2);

export const formatPercent = (share: number): string =>
  `${Math.round(share * 100)}%`;

/** A share as a whole percentage; a share above zero never reads as `0%`. */
export const formatShare = (share: number): string =>
  share > 0 && share < 0.005 ? "<1%" : formatPercent(share);

/** Splits a POSIX path into its directory (with trailing slash) and file name. */
export const splitPath = (path: string): { dir: string; name: string } => {
  const cut = path.lastIndexOf("/") + 1;
  return { dir: path.slice(0, cut), name: path.slice(cut) };
};

/** A change with its sign, using a real minus sign: `+0.31`, `−0.12`, `0.00`. */
export const formatScoreChange = (delta: number): string => {
  const text = Math.abs(delta).toFixed(2);
  if (delta === 0 || text === "0.00") {
    return text;
  }
  return `${delta > 0 ? "+" : "−"}${text}`;
};

/** A change in a share, in percentage points: `+12 pts`, `−5 pts`, `0 pts`. */
export const formatPointChange = (delta: number): string => {
  const points = Math.round(delta * 100);
  if (points === 0) {
    return "0 pts";
  }
  return `${points > 0 ? "+" : "−"}${Math.abs(points)} pts`;
};

/**
 * A file's trend in words: the signed score change and what it is measured
 * against, or `new` for a file that had no revisions in the previous window
 * (its change is just its score, not warming).
 */
export const describeScoreTrend = ({
  newlyActive,
  scoreDelta,
  previousScore,
}: NonNullable<FileStats["trend"]>): { value: string; note: string } =>
  newlyActive
    ? { value: "new", note: "no revisions in the previous window" }
    : {
        value: formatScoreChange(scoreDelta),
        note: `score change (was ${formatScore(previousScore)})`,
      };
