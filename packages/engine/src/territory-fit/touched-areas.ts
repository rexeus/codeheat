// Owns which areas a change touched, the one reading of "this change reached
// that territory" that every territory measure counts.
import { countedChanges } from "../coupling/coupling.js";
import type { History } from "../history/history.js";

/**
 * For each counted change (see `countedChanges`) of `history`, in order, the
 * distinct areas its files lie in (`areaOfFile` maps a path to its area). A
 * file with no area (a contract) counts for nothing, so a change may touch
 * none.
 */
export const touchedAreas = (
  { changes, paths }: Pick<History, "changes" | "paths">,
  areaOfFile: ReadonlyMap<string, string>,
): ReadonlyArray<ReadonlySet<string>> => {
  const areaOfId = paths.map((path) => areaOfFile.get(path));
  return countedChanges(changes).map((change) => {
    const touched = new Set<string>();
    for (const id of change.files) {
      const area = areaOfId[id];
      if (area !== undefined) {
        touched.add(area);
      }
    }
    return touched;
  });
};
