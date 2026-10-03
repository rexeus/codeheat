// Owns cutting the commits of the series span into consecutive slices by time.
import { sliceRanges, sliceStarts } from "../series/slice-ranges.js";
import type { SliceRange } from "../series/slice-ranges.js";
import type { Entry } from "./scan.js";

/** The entries of one slice of the series and the time range it covers. */
export type EntrySlice = {
  readonly range: SliceRange;
  readonly entries: ReadonlyArray<Entry>;
};

/**
 * The series: the commits from `since` (an ISO time) to `until`, cut into
 * consecutive slices by `sliceRanges`, oldest first. `entries` are every
 * commit of the series span, which no slice leaves out; there are no slices
 * when the span is too short to be cut.
 */
export const sliceSeries = (
  allEntries: ReadonlyArray<Entry>,
  since: string,
  until: string,
): {
  readonly entries: ReadonlyArray<Entry>;
  readonly slices: ReadonlyArray<EntrySlice>;
} => {
  const from = Math.floor(Date.parse(since) / 1000);
  const entries = allEntries.filter(({ signals }) => signals.time >= from);
  const ranges = sliceRanges({ since, until });
  const starts = sliceStarts(ranges);
  const parts = ranges.map(() => new Array<Entry>());
  for (const entry of entries) {
    const index = starts.filter((start) => start <= entry.signals.time).length;
    parts[index]?.push(entry);
  }
  return {
    entries,
    slices: ranges.map((range, index) => ({
      range,
      entries: parts[index] ?? [],
    })),
  };
};
