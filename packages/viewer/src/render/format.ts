import type { FileStats } from "@codeheat/engine";

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
