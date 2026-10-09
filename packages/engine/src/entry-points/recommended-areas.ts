// Owns where each file lies among the real territories of the recommended detail.
import type { Territories } from "../model/territory.js";
import { isTerritoryKind } from "../territories/recommend.js";
import { levelAt } from "../territory-fit/levels.js";

/**
 * The territory each file lies in at the recommended detail, for the files
 * whose territory there is a real one (see `isTerritoryKind`: not a bucket of
 * smaller folders). `territoryOf` maps a path to its
 * finest territory.
 */
export const realAreaOfFile = (
  territories: Territories,
  territoryOf: ReadonlyMap<string, string>,
): ReadonlyMap<string, string> => {
  const level = levelAt(territories, territories.recommended, territoryOf);
  const real = new Set(
    level.areas.filter(({ kind }) => isTerritoryKind(kind)).map(({ id }) => id),
  );
  return new Map([...level.areaOfFile].filter(([, area]) => real.has(area)));
};
