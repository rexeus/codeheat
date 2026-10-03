// Owns how the analysis window is cut into the consecutive windows of the series.

/** The most windows a series has, so the report stays small however long the history. */
const MAX_SERIES_WINDOWS = 12;

/** The series covers at least this many months, or the whole history if it is shorter, whatever the analysis window is. */
export const SERIES_MIN_MONTHS = 24;

/** The length a series window aims at: a quarter of a year. */
const QUARTER_MS = (365.25 / 4) * 24 * 60 * 60 * 1000;

/** The time range of one series window as ISO 8601 UTC timestamps. */
export type SliceRange = { readonly since: string; readonly until: string };

/**
 * Cuts `since`..`until` into equal windows of about a quarter each, at most
 * `MAX_SERIES_WINDOWS`, the last one ending at `until`; oldest first. A range
 * shorter than one and a half quarters is not cut at all: one window
 * has no series.
 */
export const sliceRanges = ({
  since,
  until,
}: SliceRange): ReadonlyArray<SliceRange> => {
  const start = Date.parse(since);
  const end = Date.parse(until);
  const count = Math.min(
    MAX_SERIES_WINDOWS,
    Math.round((end - start) / QUARTER_MS),
  );
  if (!(count >= 2)) {
    return [];
  }
  const length = (end - start) / count;
  // The ends are the given strings, so that rounding never moves the window.
  const boundary = (index: number): string => {
    if (index === 0) {
      return since;
    }
    return index === count
      ? until
      : new Date(start + index * length).toISOString();
  };
  return Array.from({ length: count }, (_, index) => ({
    since: boundary(index),
    until: boundary(index + 1),
  }));
};

/** The times in seconds since the epoch at which each window after the first starts, for `readHistoryAndSlices`. */
export const sliceStarts = (
  ranges: ReadonlyArray<SliceRange>,
): ReadonlyArray<number> =>
  ranges.slice(1).map(({ since }) => Math.floor(Date.parse(since) / 1000));
