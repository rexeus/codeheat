// Owns the territory pairs of the report: how often the hottest territories
// change together, and how many coupled file pairs cross between them.
import { Order } from "effect";

import { MIN_SHARED_COMMITS } from "../coupling/coupling.js";
import type { ModuleCoChange } from "../distant/module-co-change.js";
import type { TerritoryCoupling } from "../model/territory-coupling.js";
import type { Territory } from "../model/territory.js";
import { isRealTerritory } from "../territories/recommend.js";
import type { AreaCrossings } from "../territory-fit/crossing-pairs.js";

/** The matrix covers this many territories, the hottest (`Thresholds.maxCoupledTerritories`). */
export const MAX_COUPLED_TERRITORIES = 24;

/** The ids of the hottest real territories of `areas`, most heat first, ties by id. */
const hottestIds = (areas: ReadonlyArray<Territory>): ReadonlySet<string> =>
  new Set(
    areas
      .filter((territory) => isRealTerritory(territory))
      .toSorted((a, b) => b.heatShare - a.heatShare || Order.String(a.id, b.id))
      .slice(0, MAX_COUPLED_TERRITORIES)
      .map(({ id }) => id),
  );

/**
 * The pairs among the `MAX_COUPLED_TERRITORIES` hottest real territories of
 * `areas` (the territories at the recommended detail) that share at least
 * `MIN_SHARED_COMMITS` changes, as `coChange` counts them for every ranked
 * territory (the count behind `TerritoryFit.partner`). Each pair is listed
 * once, lower id first; the strongest first, then by ids.
 */
export const territoryPairs = (
  areas: ReadonlyArray<Territory>,
  coChange: ModuleCoChange,
  crossings: AreaCrossings,
): ReadonlyArray<TerritoryCoupling> => {
  const hottest = hottestIds(areas);
  return [...coChange.shared]
    .filter(([a]) => hottest.has(a))
    .flatMap(([a, partners]) =>
      [...partners]
        .filter(
          ([b, sharedChanges]) =>
            hottest.has(b) && sharedChanges >= MIN_SHARED_COMMITS,
        )
        .map(([b, sharedChanges]) => ({
          a,
          b,
          sharedChanges,
          distantPairs: crossings.ofPair.get(a)?.get(b)?.pairs ?? 0,
          hiddenPairs: crossings.ofPair.get(a)?.get(b)?.hidden ?? 0,
        })),
    )
    .toSorted(
      (x, y) =>
        y.sharedChanges - x.sharedChanges ||
        Order.String(x.a, y.a) ||
        Order.String(x.b, y.b),
    );
};
