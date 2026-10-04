// Owns what the territory matrix draws: which territories get a row, which
// pairs a cell, and how strong each cell reads. The numbers are the report's
// `territoryCoupling` and each territory's own fit; nothing is recomputed.
import type { Report } from "@codeheat/engine";

import { cohesionStep } from "../color/cohesion-scale.js";
import { distinctNameParts } from "../territories/distinct-names.js";
import { judgeTerritory } from "../territories/judgement.js";
import type { JudgementLimits } from "../territories/judgement.js";
import {
  isRealTerritory,
  territoryName,
} from "../territories/territory-index.js";
import type {
  NameParts,
  Territory,
  TerritoryIndex,
} from "../territories/territory-index.js";

/** Steps of the ramp a cell is colored by: 1 is the fewest shared changes shown, 5 the most. */
export const MATRIX_LEVELS = 5;

/** One territory, as a row, a column, and a diagonal cell. */
export type MatrixRow = {
  readonly id: string;
  readonly name: string;
  readonly nameParts: NameParts;
  readonly changes: number;
  /** The share of its changes that stay inside it; `null` when it is not judged. */
  readonly containment: number | null;
  /** Why it is not judged; `null` when it is. */
  readonly noData: string | null;
  /** The cohesion step the diagonal cell is colored by (0: not judged). */
  readonly step: number;
};

/** Two territories that changed together. */
export type MatrixCell = {
  readonly sharedChanges: number;
  /** Coupled file pairs between the two territories. */
  readonly distantPairs: number;
  /** Of those, the pairs no import links. */
  readonly hiddenPairs: number;
  /** 1..`MATRIX_LEVELS`, by shared changes on a log scale against the strongest cell. */
  readonly level: number;
};

/** What the matrix reads from the report: how a territory is judged, how many it covers, and how many changes rank one. */
export type MatrixLimits = JudgementLimits & {
  readonly maxCoupledTerritories: number;
};

export type Matrix = {
  /** The territories compared, hottest first: those among the hottest `maxCoupledTerritories` with at least `minModuleCommits` changes. */
  readonly rows: readonly MatrixRow[];
  /** The hottest territories left out of the matrix for having too few changes to compare, hottest first. */
  readonly notCompared: readonly MatrixRow[];
  /** The real territories at the recommended detail; more than the matrix considered when it is capped. */
  readonly total: number;
  /** How many of them the matrix considered: the hottest `maxCoupledTerritories`. */
  readonly considered: number;
  /** The most changes two territories of the matrix share; 0 without a pair. */
  readonly maxShared: number;
  /** The cell of two rows, the same for `(a, b)` and `(b, a)`; `null` on the diagonal and for a pair that shares too few changes to be listed. */
  readonly cellAt: (row: number, column: number) => MatrixCell | null;
};

const byHeat = (a: Territory, b: Territory): number => {
  if (a.heatShare !== b.heatShare) {
    return b.heatShare - a.heatShare;
  }
  return a.id < b.id ? -1 : Number(a.id > b.id);
};

const rowOf = (
  territory: Territory,
  limits: JudgementLimits,
  partsOf: (territory: Territory) => NameParts,
): MatrixRow => {
  const { containment, reason } = judgeTerritory(territory, limits);
  return {
    id: territory.id,
    name: territoryName(territory),
    nameParts: partsOf(territory),
    changes: territory.changes,
    containment,
    noData: reason,
    step: cohesionStep(containment),
  };
};

const keyOf = (a: string, b: string): string =>
  a < b ? `${a}\n${b}` : `${b}\n${a}`;

const levelOf = (shared: number, max: number): number =>
  Math.min(
    MATRIX_LEVELS,
    Math.max(
      1,
      Math.ceil((MATRIX_LEVELS * Math.log1p(shared)) / Math.log1p(max)),
    ),
  );

/**
 * The matrix of the territories at the recommended detail: among the
 * `maxCoupledTerritories` hottest real territories (the hottest first, ties by
 * id, as the engine picks them), a row for each with at least
 * `minModuleCommits` changes, the others named apart, and a cell for each pair
 * the report lists among the rows.
 */
export const matrixOf = (
  index: TerritoryIndex,
  pairs: Report["territoryCoupling"],
  limits: MatrixLimits,
): Matrix => {
  const real = index.recommended.filter(isRealTerritory);
  const hottest = real.toSorted(byHeat).slice(0, limits.maxCoupledTerritories);
  const compared = hottest.filter(
    ({ changes }) => changes >= limits.minModuleCommits,
  );
  const partsOf = distinctNameParts(hottest);
  const rows = compared.map((territory) => rowOf(territory, limits, partsOf));
  const notCompared = hottest
    .filter(({ changes }) => changes < limits.minModuleCommits)
    .map((territory) => rowOf(territory, limits, partsOf));
  const shown = new Set(rows.map(({ id }) => id));
  const listed = pairs.filter(({ a, b }) => shown.has(a) && shown.has(b));
  const maxShared = Math.max(
    0,
    ...listed.map(({ sharedChanges }) => sharedChanges),
  );
  const cells = new Map(
    listed.map((pair): [string, MatrixCell] => [
      keyOf(pair.a, pair.b),
      {
        sharedChanges: pair.sharedChanges,
        distantPairs: pair.distantPairs,
        hiddenPairs: pair.hiddenPairs,
        level: levelOf(pair.sharedChanges, maxShared),
      },
    ]),
  );
  return {
    rows,
    notCompared,
    total: real.length,
    considered: hottest.length,
    maxShared,
    cellAt: (row, column) => {
      const a = rows[row]?.id;
      const b = rows[column]?.id;
      return a === undefined || b === undefined || a === b
        ? null
        : (cells.get(keyOf(a, b)) ?? null);
    },
  };
};
