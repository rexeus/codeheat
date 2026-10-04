// Tests only: file heat in which every distinct path holds a tenth of all the heat.
import type { FileHeat } from "../entry-points/file-heat.js";

/**
 * A path holds a tenth of the heat, scaled by its weight when weighted, and
 * has ten counted changes.
 */
export const TENTH_EACH: FileHeat = {
  share: (paths) => new Set(paths).size / 10,
  weighted: (weights) =>
    [...weights].reduce((sum, [, weight]) => sum + weight / 10, 0),
  changesOf: () => 10,
};
