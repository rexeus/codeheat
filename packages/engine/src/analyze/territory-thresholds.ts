// Owns the limits of the territory-level findings, reported under
// `Report.thresholds`: the entry point gates and the size of the territory matrix.
import { ENTRY_THRESHOLDS } from "../entry-points/limits.js";
import { MAX_COUPLED_TERRITORIES } from "../territory-coupling/territory-pairs.js";

export const TERRITORY_THRESHOLDS = {
  ...ENTRY_THRESHOLDS,
  maxCoupledTerritories: MAX_COUPLED_TERRITORIES,
};
