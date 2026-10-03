// Owns reading the report's findings as entry point candidates, one rule per
// kind (see the modules of the kinds).
import type { Clique } from "../report/clique.js";
import type { CopyFamily } from "../report/copy-family.js";
import type { Coupling, FileStats } from "../report/report.js";
import type { Territories } from "../report/territory.js";
import type { UnstableInterface } from "../report/unstable-interface.js";
import { isTerritoryKind } from "../territories/recommend.js";
import { levelAt } from "../territory-fit/levels.js";
import { chainsOf } from "./ancestry.js";
import { boundaryEntries } from "./boundary.js";
import type { Candidate } from "./candidate.js";
import { cliqueEntries } from "./clique.js";
import { copiesEntries } from "./copies.js";
import { couplingEntries } from "./coupling.js";
import { hotspotEntries } from "./hotspot.js";
import { hubEntries } from "./hub.js";
import { judgedTerritories } from "./judged-territories.js";

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
  /** The counted changes of the window (`Report.window.couplingCommits`). */
  readonly changes: number;
  /** Fewest counted changes at which a territory is judged (`Thresholds.minModuleCommits`). */
  readonly minChanges: number;
};

/**
 * Every candidate of every kind, unranked: territories whose boundary does not
 * hold, territories whose heat is chronic, cliques of territories, copy
 * families, unstable interfaces, and hidden couplings across territories.
 */
export const gatherCandidates = (
  input: EntryPointInput,
): ReadonlyArray<Candidate> => {
  const { territories, files } = input;
  const judged = judgedTerritories(territories, input.minChanges);
  const byId = new Map(territories.nodes.map((node) => [node.id, node]));
  const pathOf = new Map(territories.nodes.map(({ id, path }) => [id, path]));
  const territoryOf = new Map(
    files.map(({ path, territory }) => [path, territory]),
  );
  const level = levelAt(territories, territories.recommended, territoryOf);
  const real = new Set(
    level.areas.filter(({ kind }) => isTerritoryKind(kind)).map(({ id }) => id),
  );
  const areaOfFile = new Map(
    [...level.areaOfFile].filter(([, area]) => real.has(area)),
  );
  return [
    ...boundaryEntries(judged, pathOf),
    ...hotspotEntries(judged, files, chainsOf(territories.nodes)),
    ...cliqueEntries(input.cliques, byId),
    ...copiesEntries(input.copyFamilies, territoryOf, input.changes),
    ...hubEntries(input.unstableInterfaces, territoryOf, input.changes),
    ...couplingEntries(input.couplings, areaOfFile, territoryOf, input.changes),
  ];
};
