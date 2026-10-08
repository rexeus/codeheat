// Owns the heat of one file: the change effort it took in the window.
import type { FileStats } from "../model/analysis.js";

/**
 * The heat of a file: `changes × (loc + complexity.total)`, over the counted
 * changes, as `Territory.heatShare` counts it.
 */
export const heatOfFile = ({
  changes,
  loc,
  complexity,
}: Pick<FileStats, "changes" | "loc" | "complexity">): number =>
  changes * (loc + complexity.total);
