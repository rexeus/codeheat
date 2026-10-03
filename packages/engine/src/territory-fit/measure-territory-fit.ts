// Owns the design fit of the territories: every territory measured once, at
// the detail closest to the recommended one, and the cliques the recommended
// detail shows.
import type { Clique } from "../report/clique.js";
import type { FileStats } from "../report/report.js";
import type { Territories } from "../report/territory.js";
import { chronicHeat } from "./chronic-heat.js";
import { homeDetails, levelAt } from "./levels.js";
import { measureLevel } from "./measure-level.js";
import type { LevelFit, LevelInput } from "./measure-level.js";

export type TerritoryFitInput = LevelInput & {
  /** The files with their finest `territory` and `heat`. */
  readonly files: ReadonlyArray<FileStats>;
};

/** The territories with their `fit`, and the cliques among the territories at the recommended detail. */
export type FittedTerritories = {
  readonly territories: Territories;
  readonly cliques: ReadonlyArray<Clique>;
};

/**
 * Measures every territory except the root, which has no boundary. The
 * boundary measures are taken against the territories at the territory's home
 * detail (see `homeDetails`); each detail that is a home is measured once.
 */
export const measureTerritoryFit = (
  territories: Territories,
  input: TerritoryFitInput,
): FittedTerritories => {
  const homes = homeDetails(territories);
  const fileTerritories = new Map(
    input.files.map(({ path, territory }) => [path, territory]),
  );
  const measured = new Map(
    [...new Set([...homes.values(), territories.recommended])]
      .filter((detail) => detail > 0)
      .map((detail) => [
        detail,
        measureLevel(levelAt(territories, detail, fileTerritories), input),
      ]),
  );
  const chronic = chronicHeat(territories.nodes, input.files);
  return {
    territories: {
      ...territories,
      nodes: territories.nodes.map((node) => {
        const home = homes.get(node.id);
        const level: LevelFit | undefined =
          home === undefined
            ? undefined
            : measured.get(home)?.fits.get(node.id);
        const heat = chronic.get(node.id);
        return {
          ...node,
          fit:
            level === undefined
              ? null
              : {
                  ...level,
                  chronicFiles: heat?.chronicFiles ?? 0,
                  acuteFiles: heat?.acuteFiles ?? 0,
                  chronicShare: heat?.chronicShare ?? 0,
                },
        };
      }),
    },
    cliques: measured.get(territories.recommended)?.cliques ?? [],
  };
};
