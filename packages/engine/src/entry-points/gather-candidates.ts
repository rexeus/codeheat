// Owns reading the report's findings as entry point candidates, one rule per
// kind (see the modules of the kinds).
import type { Coupling, FileStats } from "../model/analysis.js";
import type { Clique } from "../model/clique.js";
import type { CopyFamily } from "../model/copy-family.js";
import type { Territories } from "../model/territory.js";
import type { UnstableInterface } from "../model/unstable-interface.js";
import { boundaryEntries } from "./boundary.js";
import type { BoundaryContext } from "./boundary.js";
import type { Candidate } from "./candidate.js";
import { cliqueEntries } from "./clique.js";
import { copiesEntries } from "./copies.js";
import { couplingEntries } from "./coupling.js";
import { codeHeatShares, fileHeatOf } from "./file-heat.js";
import { hotspotEntries } from "./hotspot.js";
import { hubEntries } from "./hub.js";
import { judgedTerritories } from "./judged-territories.js";
import type { EntryLimits } from "./limits.js";
import { realAreaOfFile } from "./recommended-areas.js";

/** What the entry points are read from. */
export type EntryPointInput = {
  /** The territories with their fit; the recommended detail is the one judged. */
  readonly territories: Territories;
  readonly files: ReadonlyArray<FileStats>;
  /** The cliques among the territories at the recommended detail. */
  readonly cliques: ReadonlyArray<Clique>;
  readonly copyFamilies: ReadonlyArray<CopyFamily>;
  /** The reported couplings of the window. */
  readonly couplings: ReadonlyArray<Coupling>;
  readonly unstableInterfaces: ReadonlyArray<UnstableInterface>;
  /** Fewest counted changes at which a territory is judged (`Thresholds.minModuleCommits`). */
  readonly minChanges: number;
  /** The coupled file pairs that cross between the territories at the recommended detail, which a boundary between two territories counts once. */
  readonly crossings: BoundaryContext["crossings"];
  /** The gates (`Analysis.thresholds`). */
  readonly limits: EntryLimits;
};

/**
 * Every candidate of every kind, unranked: territories whose boundary does not
 * hold, territories whose heat is chronic, cliques of territories, copy
 * families, unstable interfaces, and hidden couplings across territories.
 */
export const gatherCandidates = (
  input: EntryPointInput,
): ReadonlyArray<Candidate> => {
  const { territories, files, limits } = input;
  const codeHeat = codeHeatShares(files, territories.nodes);
  const judged = judgedTerritories(territories, input.minChanges, codeHeat);
  const byId = new Map(territories.nodes.map((node) => [node.id, node]));
  const pathOf = new Map(territories.nodes.map(({ id, path }) => [id, path]));
  const territoryOf = new Map(
    files.map(({ path, territory }) => [path, territory]),
  );
  const heat = fileHeatOf(files);
  const areaOfFile = realAreaOfFile(territories, territoryOf);
  return [
    ...boundaryEntries(judged, {
      pathOf,
      limits,
      crossings: input.crossings,
      cliques: input.cliques,
    }),
    ...hotspotEntries(
      judged,
      { files, nodes: territories.nodes, heat },
      limits,
    ),
    ...cliqueEntries(input.cliques, byId, codeHeat, limits),
    ...copiesEntries(input.copyFamilies, territoryOf, heat, limits),
    ...hubEntries(input.unstableInterfaces, territoryOf, heat, limits),
    ...couplingEntries(
      input.couplings,
      { areaOfFile, territoryOf },
      heat,
      limits,
    ),
  ];
};
