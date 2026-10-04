// Owns the territory cliques of the report: the cliques among the territories
// at the recommended detail, with the heat they hold.
import { cliqueHeat } from "../entry-points/clique.js";
import type { Clique } from "../report/clique.js";
import { roundReported } from "../report/precision.js";
import type { TerritoryClique } from "../report/territory-coupling.js";
import type { Territory } from "../report/territory.js";

/**
 * The cliques of territories (see `Clique`; the members are territory ids) as
 * the report lists them, in the order they were found, with the evidence an
 * entry point of kind `clique` is scored on: `byId` finds a territory,
 * `codeHeat` gives each one's share of the production code's heat.
 */
export const territoryCliques = (
  cliques: ReadonlyArray<Clique>,
  byId: ReadonlyMap<string, Territory>,
  codeHeat: ReadonlyMap<string, number>,
): ReadonlyArray<TerritoryClique> =>
  cliques.map((clique) => {
    const { heatShare, codeHeatShare } = cliqueHeat(clique, byId, codeHeat);
    return {
      territories: clique.modules,
      sharedChanges: clique.sharedCommits,
      weakestShare: clique.weakestShare,
      heatShare: roundReported(Math.min(1, heatShare)),
      codeHeatShare: roundReported(Math.min(1, codeHeatShare)),
    };
  });
