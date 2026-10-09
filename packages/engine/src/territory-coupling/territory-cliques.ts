// Owns the territory cliques of the report: the cliques among the territories
// at the recommended detail, with the heat they hold.
import { cliqueHeat } from "../entry-points/clique.js";
import type { Clique } from "../model/clique.js";
import { roundReported } from "../model/precision.js";
import type { TerritoryClique } from "../model/territory-coupling.js";
import type { Territory } from "../model/territory.js";

/**
 * The cliques of territories (see `Clique`; the members are territory ids) as
 * the report lists them, in the order they were found, with the evidence an
 * entry point of kind `clique` is scored on: `byId` finds a territory.
 */
export const territoryCliques = (
  cliques: ReadonlyArray<Clique>,
  byId: ReadonlyMap<string, Territory>,
): ReadonlyArray<TerritoryClique> =>
  cliques.map((clique) => {
    const { heatShare } = cliqueHeat(clique, byId);
    return {
      territories: clique.modules,
      sharedChanges: clique.sharedCommits,
      weakestShare: clique.weakestShare,
      heatShare: roundReported(Math.min(1, heatShare)),
    };
  });
