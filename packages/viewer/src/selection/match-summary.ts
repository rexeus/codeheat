import type { FileStats } from "@codeheat/engine";

import { formatCount } from "../render/format.js";
import type { PathMatcher } from "./filter.js";

/** The files the filter counts against: all of them, or those of the territory the map is zoomed to (named in `territory`). */
export type FilterScope = {
  readonly files: readonly FileStats[];
  readonly territory: string | null;
};

/** How many files of `scope` the filter matches, or an empty string without a filter. */
export const matchSummary = (
  matcher: PathMatcher | null,
  { files, territory }: FilterScope,
): string => {
  if (matcher === null) {
    return "";
  }
  const matching = files.filter(({ path }) => matcher(path)).length;
  const where = territory === null ? "" : ` in ${territory}`;
  return `${formatCount(matching)} of ${formatCount(files.length)} files${where} match`;
};
