// Owns how much of a territory's heat is the long-lived kind: chronic hotspots
// among its files, and the acute ones.
import type { FileStats } from "../model/analysis.js";
import { roundReported } from "../model/precision.js";
import type { TerritoryFit } from "../model/territory-fit.js";
import type { Territory } from "../model/territory.js";

/** What the files of one territory say about its chronic and acute heat. */
export type ChronicHeat = Pick<
  TerritoryFit,
  "chronicFiles" | "acuteFiles" | "chronicShare"
>;

type Tally = {
  chronic: number;
  acute: number;
  heat: number;
  chronicHeat: number;
};

/**
 * For every territory, the chronic and acute hotspots among the files it holds
 * (below it included) and the share of its code's heat the chronic ones carry.
 * `nodes` is the tree; each file names its finest territory. Test code is
 * left out: it has no heat kind, and tests are no design.
 */
export const chronicHeat = (
  nodes: ReadonlyArray<Pick<Territory, "id" | "parent">>,
  files: ReadonlyArray<
    Pick<FileStats, "territory" | "test" | "heat" | "changes" | "loc"> & {
      readonly complexity: Pick<FileStats["complexity"], "total">;
    }
  >,
): ReadonlyMap<string, ChronicHeat> => {
  const parents = new Map(nodes.map(({ id, parent }) => [id, parent]));
  const tallies = new Map<string, Tally>();
  for (const file of files) {
    if (file.test) {
      continue;
    }
    const heat = file.changes * (file.loc + file.complexity.total);
    for (
      let id: string | null | undefined = file.territory;
      id !== null && id !== undefined;
      id = parents.get(id)
    ) {
      const own = tallies.get(id) ?? {
        chronic: 0,
        acute: 0,
        heat: 0,
        chronicHeat: 0,
      };
      own.heat += heat;
      own.chronic += file.heat?.kind === "chronic" ? 1 : 0;
      own.acute += file.heat?.kind === "acute" ? 1 : 0;
      own.chronicHeat += file.heat?.kind === "chronic" ? heat : 0;
      tallies.set(id, own);
    }
  }
  return new Map(
    [...tallies].map(([id, own]) => [
      id,
      {
        chronicFiles: own.chronic,
        acuteFiles: own.acute,
        chronicShare: roundReported(
          own.heat === 0 ? 0 : own.chronicHeat / own.heat,
        ),
      },
    ]),
  );
};
