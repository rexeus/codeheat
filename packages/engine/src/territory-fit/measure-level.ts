// Owns measuring the territories visible at one detail with the rules of the
// module measures: containment, radius, partners, cliques, erosion, and fixes.
import { countedChanges } from "../coupling/coupling.js";
import { findCliques } from "../distant/cliques.js";
import { moduleCoChange } from "../distant/module-co-change.js";
import type { ModuleCoChange } from "../distant/module-co-change.js";
import { withModuleErosion } from "../erosion/module-erosion.js";
import { measureFixes } from "../fixes/fix-density.js";
import type { History } from "../history/history.js";
import type { Coupling } from "../model/analysis.js";
import type { Clique } from "../model/clique.js";
import { roundReported } from "../model/precision.js";
import type { TerritoryFit } from "../model/territory-fit.js";
import { measureRadius } from "../spread/change-radius.js";
import { crossingPairs } from "./crossing-pairs.js";
import type { AreaCrossings } from "./crossing-pairs.js";
import type { Level } from "./levels.js";
import { strongestPartners } from "./partners.js";
import { touchedAreas } from "./touched-areas.js";

/** What one detail says about a territory; the rest of `TerritoryFit` does not depend on the detail. */
export type LevelFit = Pick<
  TerritoryFit,
  | "detail"
  | "containment"
  | "radius"
  | "partner"
  | "distantPairs"
  | "hiddenPairs"
  | "cliques"
  | "erosion"
  | "fixDensity"
>;

/** The part of a window's history the measures read. */
type ChangeHistory = Pick<History, "changes" | "paths">;

/** What every detail is measured over. */
export type LevelInput = {
  readonly couplings: ReadonlyArray<Coupling>;
  /** The window the report describes. */
  readonly history: ChangeHistory;
  /** The windows of the series, oldest first. */
  readonly series: ReadonlyArray<{ readonly history: ChangeHistory }>;
  /** Fewest counted changes at which a territory is ranked (`Thresholds.minModuleCommits`). */
  readonly minChanges: number;
};

type Tally = { commits: number; local: number };

/** Per area, how many changes touched it and how many of those touched nothing else. */
const tally = (
  touched: ReadonlyArray<ReadonlySet<string>>,
): ReadonlyMap<string, Tally> => {
  const tallies = new Map<string, Tally>();
  for (const areas of touched) {
    for (const area of areas) {
      const own = tallies.get(area) ?? { commits: 0, local: 0 };
      own.commits += 1;
      own.local += areas.size === 1 ? 1 : 0;
      tallies.set(area, own);
    }
  }
  return tallies;
};

/**
 * What one detail says about its territories: the fit of each, the cliques
 * among them, and the counts those were read from (the changes every pair of
 * ranked territories shares and the file pairs crossing between them).
 */
export type MeasuredLevel = {
  readonly fits: ReadonlyMap<string, LevelFit>;
  readonly cliques: ReadonlyArray<Clique>;
  readonly coChange: ModuleCoChange;
  readonly crossings: AreaCrossings;
  /**
   * Per window of the series, oldest first, the areas each of its counted
   * changes touched (see `touchedAreas`): what the trends of the areas are
   * read from.
   */
  readonly windows: ReadonlyArray<ReadonlyArray<ReadonlySet<string>>>;
};

type Area = {
  readonly path: string;
  readonly commits: number;
};

/** The areas of `level` as the module measures read them: buckets (`other`) are never ranked, so they carry no commits. */
const areasOf = (
  level: Level,
  tallies: ReadonlyMap<string, Tally>,
): ReadonlyArray<Area> =>
  level.areas.map(({ id, kind }) => ({
    path: id,
    commits: kind === "other" ? 0 : (tallies.get(id)?.commits ?? 0),
  }));

/** What the measures over time say about each area: its erosion and its fixes. */
const overTime = (
  level: Level,
  areas: ReadonlyArray<Area>,
  input: LevelInput,
  touched: ReadonlyArray<ReadonlySet<string>>,
) => {
  const windows = input.series.map(({ history }) =>
    touchedAreas(history, level.areaOfFile),
  );
  const fixes = measureFixes(
    countedChanges(input.history.changes),
    touched,
    areas,
  );
  return {
    windows,
    erosions: new Map(
      withModuleErosion(areas, windows).map((area) => [
        area.path,
        area.erosion,
      ]),
    ),
    fixes: new Map(fixes.modules.map((area) => [area.path, area.fixDensity])),
  };
};

/**
 * Measures the territories of `level` over `input`. A bucket of smaller
 * folders (`other`) is measured but never ranked for partners and cliques.
 */
export const measureLevel = (
  level: Level,
  input: LevelInput,
): MeasuredLevel => {
  const touched = touchedAreas(input.history, level.areaOfFile);
  const tallies = tally(touched);
  const areas = areasOf(level, tallies);
  const radii = new Map(
    measureRadius(touched, areas).modules.map((area) => [area.path, area]),
  );
  const { windows, erosions, fixes } = overTime(level, areas, input, touched);
  const coChange = moduleCoChange(touched, areas, input.minChanges);
  const { cliques } = findCliques(coChange, touched);
  const partners = strongestPartners(coChange);
  const crossings = crossingPairs(input.couplings, level.areaOfFile);
  const fits = new Map(
    areas.map(({ path }): [string, LevelFit] => {
      const own = tallies.get(path);
      return [
        path,
        {
          detail: level.detail,
          containment:
            own === undefined ? null : roundReported(own.local / own.commits),
          radius: radii.get(path)?.radius ?? null,
          partner: partners.get(path) ?? null,
          distantPairs: crossings.ofArea.get(path)?.pairs ?? 0,
          hiddenPairs: crossings.ofArea.get(path)?.hidden ?? 0,
          cliques: cliques.filter(({ modules }) => modules.includes(path))
            .length,
          erosion: erosions.get(path) ?? null,
          fixDensity: fixes.get(path) ?? null,
        },
      ];
    }),
  );
  return { fits, cliques, coChange, crossings, windows };
};
