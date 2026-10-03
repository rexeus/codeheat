import { findCliques } from "../distant/cliques.js";
import {
  moduleCoChange,
  moduleCouplings,
} from "../distant/module-co-change.js";
// Owns what the counted changes of the analysis window say about the design
// once files and modules are measured: which modules change together, how far
// a change spreads, and how that moved over the consecutive windows.
import { withModuleErosion } from "../erosion/module-erosion.js";
import { judgeErosion } from "../erosion/repository-erosion.js";
import { touchedModules } from "../modules/touched-modules.js";
import type { Coupling } from "../report/report.js";
import { measureSpread } from "../spread/measure-spread.js";
import { measureSlices } from "./measure-series.js";
import type { Universe, measureWindows } from "./measure.js";
import type { WindowHistories } from "./windows.js";

/**
 * Measures the latest window's co-change between modules, its spread, and the
 * series of its slices, over the files and modules `measured` lists (the
 * result of `measureWindows`) and the window's reported `couplings`.
 */
export const measureDesignFit = (
  universe: Universe,
  histories: WindowHistories,
  measured: ReturnType<typeof measureWindows>,
  couplings: ReadonlyArray<Coupling>,
) => {
  const touched = touchedModules(histories.current, universe);
  const coChange = moduleCoChange(
    touched,
    measured.modules,
    measured.thresholds.minModuleCommits,
  );
  const cliqueSearch = findCliques(coChange, touched);
  const spread = measureSpread(histories.current, touched, measured, couplings);
  const slices = measureSlices(universe, histories.series, {
    ...measured,
    modules: spread.modules,
  });
  const series = slices.map(({ window }) => window);
  return {
    ...spread,
    modules: withModuleErosion(
      spread.modules,
      slices.map((slice) => slice.touched),
    ),
    series,
    erosion: judgeErosion(series),
    moduleCoupling: moduleCouplings(coChange),
    cliques: cliqueSearch.cliques,
    cliquesPartial: cliqueSearch.partial,
  };
};
