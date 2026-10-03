// Owns cutting a window's commits into consecutive slices by time.
import type { Entry } from "./scan.js";

/**
 * The entries of each slice of a window, oldest slice first. `starts` are the
 * times in seconds since the epoch, ascending, at which each slice after the
 * first begins; the first slice takes everything before `starts[0]`. Without
 * starts there is no slice at all, not one that holds everything.
 */
export const partitionEntries = (
  entries: ReadonlyArray<Entry>,
  starts: ReadonlyArray<number>,
): ReadonlyArray<ReadonlyArray<Entry>> => {
  if (starts.length === 0) {
    return [];
  }
  const slices = Array.from(
    { length: starts.length + 1 },
    () => new Array<Entry>(),
  );
  for (const entry of entries) {
    const index = starts.filter((start) => start <= entry.signals.time).length;
    slices[index]?.push(entry);
  }
  return slices;
};
