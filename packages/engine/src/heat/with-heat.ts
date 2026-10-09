// Owns setting the heat of the files of a report.
import type { FileStats } from "../model/analysis.js";
import { heatOf } from "./classify-heat.js";
import type { HeatWindow } from "./classify-heat.js";

/** The files with their `heat` set over the windows of the series. */
export const withHeat = (
  files: ReadonlyArray<FileStats>,
  windows: ReadonlyArray<HeatWindow>,
): ReadonlyArray<FileStats> =>
  files.map((file) => ({
    ...file,
    heat: heatOf(file.path, windows),
  }));
