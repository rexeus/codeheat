// Owns setting the heat of the files of a report.
import type { FileStats } from "../report/report.js";
import { heatOf } from "./classify-heat.js";
import type { HeatWindow } from "./classify-heat.js";

/** The files with their `heat` set over the windows of the series; test code has none, since tests are no design. */
export const withHeat = (
  files: ReadonlyArray<FileStats>,
  windows: ReadonlyArray<HeatWindow>,
): ReadonlyArray<FileStats> =>
  files.map((file) => ({
    ...file,
    heat: file.test ? null : heatOf(file.path, windows),
  }));
