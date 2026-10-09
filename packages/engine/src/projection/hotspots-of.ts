// Owns the hotspots of report v2: the production files with the most heat.
import { Order } from "effect";

import { realAreaOfFile } from "../entry-points/recommended-areas.js";
import { heatOfFile } from "../heat/file-heat.js";
import type { Analysis, FileStats } from "../model/analysis.js";
import type { Hotspot } from "../report/hotspot.js";
import { percentOf } from "./units.js";

/** Hotspots the report lists. */
const MAX_HOTSPOTS = 10;

/** A file among the hottest, with the real territory at the recommended detail that holds it. */
export type HotFile = {
  readonly file: FileStats;
  /** The file's share of all the heat. */
  readonly share: number;
  /** `id` of the real territory at the recommended detail that holds the file; null for a file in a bucket or loose files. */
  readonly area: string | null;
};

type Heated = { readonly file: FileStats; readonly heat: number };

const hottestFirst = Order.combine(
  Order.mapInput(Order.flip(Order.Number), ({ heat }: Heated) => heat),
  Order.mapInput(Order.String, ({ file }: Heated) => file.path),
);

/**
 * The `MAX_HOTSPOTS` files of `analysis` with the most heat, the most first,
 * ties by path; a file without heat is none. The share is one of all the
 * heat, as an area's heat is.
 */
export const hotFilesOf = ({
  files,
  territories,
}: Pick<Analysis, "files" | "territories">): ReadonlyArray<HotFile> => {
  const total = files.reduce((sum, file) => sum + heatOfFile(file), 0);
  const areaOf = realAreaOfFile(
    territories,
    new Map(files.map(({ path, territory }) => [path, territory])),
  );
  return files
    .map((file) => ({ file, heat: heatOfFile(file) }))
    .filter(({ heat }) => heat > 0)
    .toSorted(hottestFirst)
    .slice(0, MAX_HOTSPOTS)
    .map(({ file, heat }) => ({
      file,
      share: heat / total,
      area: areaOf.get(file.path) ?? null,
    }));
};

/** The hotspots of report v2; `pathOf` names a territory by its id. */
export const hotspotsOf = (
  hottest: ReadonlyArray<HotFile>,
  pathOf: (id: string) => string,
): ReadonlyArray<Hotspot> =>
  hottest.map(({ file, share, area }) => ({
    path: file.path,
    area: area === null ? null : pathOf(area),
    heat: percentOf(share),
    changes: file.changes,
    lines: file.loc,
    complexity: file.complexity.total,
    chronic: file.heat?.kind === "chronic",
  }));
