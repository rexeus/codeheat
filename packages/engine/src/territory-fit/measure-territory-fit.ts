// Owns the design fit of the territories: every territory measured once, at
// the detail closest to the recommended one, and the cliques the recommended
// detail shows.
import type { FileStats } from "../model/analysis.js";
import type { Clique } from "../model/clique.js";
import type { Territories } from "../model/territory.js";
import { chronicHeat } from "./chronic-heat.js";
import { NO_CROSSINGS } from "./crossing-pairs.js";
import type { AreaCrossings } from "./crossing-pairs.js";
import { homeDetails, levelAt } from "./levels.js";
import type { Level } from "./levels.js";
import { measureLevel } from "./measure-level.js";
import type { LevelFit, LevelInput, MeasuredLevel } from "./measure-level.js";

export type TerritoryFitInput = LevelInput & {
  /** The files with their finest `territory` and `heat`. */
  readonly files: ReadonlyArray<FileStats>;
};

/**
 * The territories with their `fit`, and the cliques among the territories at
 * the recommended detail, with the detail's partition and counts for what is
 * read between territories (`null` when the report has no territories).
 */
export type FittedTerritories = {
  readonly territories: Territories;
  readonly cliques: ReadonlyArray<Clique>;
  readonly recommended: {
    readonly level: Level;
    readonly measured: MeasuredLevel;
  } | null;
  /** The coupled file pairs between the territories at the recommended detail; none without one. */
  readonly crossings: AreaCrossings;
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
  const levels = new Map(
    [...new Set([...homes.values(), territories.recommended])]
      .filter((detail) => detail > 0)
      .map((detail) => [detail, levelAt(territories, detail, fileTerritories)]),
  );
  const measured = new Map(
    [...levels].map(([detail, level]) => [detail, measureLevel(level, input)]),
  );
  const recommendedLevel = levels.get(territories.recommended);
  const recommendedMeasured = measured.get(territories.recommended);
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
    cliques: recommendedMeasured?.cliques ?? [],
    crossings: recommendedMeasured?.crossings ?? NO_CROSSINGS,
    recommended:
      recommendedLevel === undefined || recommendedMeasured === undefined
        ? null
        : { level: recommendedLevel, measured: recommendedMeasured },
  };
};
