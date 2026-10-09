// Owns which areas report v2 lists and what it says about each; the areas it
// does not list are summed up as the rest.
import { Order } from "effect";

import type { Analysis } from "../model/analysis.js";
import type { Territory } from "../model/territory.js";
import type { Area } from "../report/area.js";
import type { Basis } from "../report/basis.js";
import { isTerritoryKind } from "../territories/recommend.js";
import { isJudged, standingOf } from "../verdict/judge-verdict.js";
import type { Standing } from "../verdict/judge-verdict.js";
import { percentOf, percentsOf, shareOf } from "./units.js";

/** An area that is neither judged nor named elsewhere is listed from this share of all the heat on. */
const MIN_LISTED_HEAT = 0.01;

type Limits = Parameters<typeof standingOf>[1];

type Listed = { readonly territory: Territory; readonly standing: Standing };

/** The listed areas and the rest. */
export type AreaListing = {
  readonly areas: ReadonlyArray<Area>;
  readonly rest: Basis["rest"];
};

/** The territories at the recommended detail, in the order of the detail. */
const recommendedOf = ({
  recommended,
  details,
  nodes,
}: Analysis["territories"]): ReadonlyArray<Territory> => {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const ids = details.find(({ level }) => level === recommended)?.ids ?? [];
  return ids.flatMap((id) => byId.get(id) ?? []);
};

const byHeat = Order.combine(
  Order.mapInput(
    Order.flip(Order.Number),
    ({ heatShare }: Territory) => heatShare,
  ),
  Order.mapInput(Order.String, ({ path }: Territory) => path),
);

const noteOf = (standing: Standing): Pick<Area, "note"> =>
  standing === "few-changes" || standing === "no-partner"
    ? { note: standing }
    : {};

const staysOf = (territory: Territory, standing: Standing): number | null => {
  const containment = territory.fit?.containment ?? null;
  return isJudged(standing) && containment !== null
    ? shareOf(containment)
    : null;
};

/** The unlisted territory with the most heat, at most `restHeat`; null when there is none. */
const largestOf = (
  rest: ReadonlyArray<Territory>,
  restHeat: number,
): Basis["rest"]["largest"] => {
  const [largest] = rest.toSorted(byHeat);
  return largest === undefined
    ? null
    : {
        path: largest.path,
        heat: Math.min(percentOf(largest.heatShare), restHeat),
      };
};

/** What report v2 says about one listed area with `heat`; `pathOf` names another territory by its id. */
const areaOf = (
  { territory, standing }: Listed,
  heat: number,
  pathOf: (id: string) => string,
): Area => {
  const { fit } = territory;
  const partner = standing === "leaks" ? (fit?.partner ?? null) : null;
  const trend = fit?.erosion?.verdict;
  const chronicFiles = fit?.chronicFiles ?? 0;
  return {
    path: territory.path,
    description: territory.description,
    files: territory.files,
    changes: territory.changes,
    heat,
    stays: staysOf(territory, standing),
    ...noteOf(standing),
    ...(partner === null
      ? {}
      : {
          leaksInto: {
            path: pathOf(partner.territory),
            changes: partner.sharedChanges,
          },
        }),
    ...(trend === "eroding" || trend === "improving" ? { trend } : {}),
    ...(chronicFiles > 0 ? { hotspots: chronicFiles } : {}),
  };
};

/**
 * The areas of `analysis` that report v2 lists, the most heat first, ties by
 * path, and the rest. An area is a real territory (package, folder, group,
 * or the loose files of a directory)
 * at the recommended detail; it is listed when it is judged (see
 * `standingOf`), holds at least `MIN_LISTED_HEAT` of all the heat, is the
 * partner a listed area leaks into, or is one of `named` (ids of territories
 * the report names elsewhere), so that every area name the report uses is
 * listed. The rest holds every other territory of the detail, buckets of
 * smaller folders included; its `areas`
 * counts the real ones. The detail splits all the heat, so the heat of the
 * listed areas and of the rest adds up to exactly 100, or is 0 without any
 * heat (see `percentsOf`).
 */
export const areasOf = (
  analysis: Pick<Analysis, "territories"> & { readonly thresholds: Limits },
  named: ReadonlySet<string>,
): AreaListing => {
  const { territories, thresholds } = analysis;
  const paths = new Map(territories.nodes.map(({ id, path }) => [id, path]));
  const pathOf = (id: string): string => paths.get(id) ?? id;
  const real = recommendedOf(territories)
    .filter(({ kind }) => isTerritoryKind(kind))
    .map((territory) => ({
      territory,
      standing: standingOf(territory, thresholds),
    }));
  const leakedInto = new Set(
    real.flatMap(({ territory, standing }) =>
      standing === "leaks" ? (territory.fit?.partner?.territory ?? []) : [],
    ),
  );
  const isListed = (territory: Territory, standing: Standing): boolean =>
    isJudged(standing) ||
    territory.heatShare >= MIN_LISTED_HEAT ||
    named.has(territory.id) ||
    leakedInto.has(territory.id);
  const listed = real
    .filter(({ territory, standing }) => isListed(territory, standing))
    .toSorted((one, other) => byHeat(one.territory, other.territory));
  const listedIds = new Set(listed.map(({ territory }) => territory.id));
  const rest = recommendedOf(territories).filter(
    ({ id }) => !listedIds.has(id),
  );
  const heats = percentsOf([
    ...listed.map(({ territory }) => territory.heatShare),
    rest.reduce((sum, { heatShare }) => sum + heatShare, 0),
  ]);
  return {
    areas: listed.map((area, index) => areaOf(area, heats[index] ?? 0, pathOf)),
    rest: {
      areas: rest.filter(({ kind }) => isTerritoryKind(kind)).length,
      files: rest.reduce((sum, { files }) => sum + files, 0),
      heat: heats[listed.length] ?? 0,
      largest: largestOf(rest, heats[listed.length] ?? 0),
    },
  };
};
