// Owns measuring the consecutive windows of the series: what each says about
// how far a change spread and which files were hot, over the universe the report describes.
import type { HeatWindow } from "../heat/classify-heat.js";
import { heatWindow } from "../heat/heat-window.js";
import type { SeriesSlice } from "../history/history.js";
import { touchedModules } from "../modules/touched-modules.js";
import type { ContractFile } from "../report/contract-file.js";
import type { Module } from "../report/module.js";
import type { FileStats } from "../report/report.js";
import type { SeriesWindow } from "../report/series.js";
import { MIN_WINDOW_CHANGES } from "../series/active-window.js";
import { measureSpread } from "../spread/measure-spread.js";
import { coupleHistory } from "./measure.js";
import type { Universe } from "./measure.js";

/** What a window of the series says, with the modules each of its counted changes touched. */
export type MeasuredSlice = {
  readonly window: SeriesWindow;
  /** The distinct modules each counted change touched (see `touchedModules`). */
  readonly touched: ReadonlyArray<ReadonlySet<string>>;
  /** Which files the window touched and which were hot. */
  readonly heat: HeatWindow;
};

/**
 * Measures each slice of the series over `universe`. `measured` supplies the
 * modules, files, and contracts the report lists, which every slice is
 * measured over, whatever span the slice lies in.
 */
export const measureSlices = (
  universe: Universe,
  slices: ReadonlyArray<SeriesSlice>,
  measured: {
    readonly modules: ReadonlyArray<Module>;
    readonly files: ReadonlyArray<FileStats>;
    readonly contracts: ReadonlyArray<ContractFile>;
  },
): ReadonlyArray<MeasuredSlice> =>
  slices.map(({ range, history }) => {
    const touched = touchedModules(history, universe);
    const active = touched.length >= MIN_WINDOW_CHANGES;
    const { couplings } = coupleHistory(history, universe);
    const { changeRadius, propagationCost } = measureSpread(
      history,
      touched,
      measured,
      couplings,
    );
    return {
      window: {
        ...range,
        changes: touched.length,
        active,
        changeRadius,
        propagationCost,
      },
      touched,
      heat: heatWindow(universe.files, history, active),
    };
  });
