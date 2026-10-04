// Owns what the territory matrix draws: which territories get a row, which
// pairs a cell, and how strong each cell reads. The numbers are the report's
// `territoryCoupling` and each territory's own fit; nothing is recomputed.
import type { Report } from "@codeheat/engine";

import { cohesionStep } from "../color/cohesion-scale.js";
import { judgeTerritory } from "../territories/judgement.js";
import type { JudgementLimits } from "../territories/judgement.js";
import {
  isRealTerritory,
  territoryName,
  territoryNameParts,
} from "../territories/territory-index.js";
import type {
  NameParts,
  Territory,
  TerritoryIndex,
} from "../territories/territory-index.js";

/** The matrix covers this many territories, the hottest; the engine lists the pairs of the same ones. */
const MATRIX_TERRITORIES = 24;

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

export type Matrix = {
  readonly rows: readonly MatrixRow[];
  /** The real territories at the recommended detail; more than `rows` when the matrix is capped. */
  readonly total: number;
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

const rowOf = (territory: Territory, limits: JudgementLimits): MatrixRow => {
  const { containment, reason } = judgeTerritory(territory, limits);
  return {
    id: territory.id,
    name: territoryName(territory),
    nameParts: territoryNameParts(territory),
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
 * The matrix of the territories at the recommended detail: a row for each of
 * the `MATRIX_TERRITORIES` hottest real territories (the hottest first, ties
 * by id, as the engine picks them) and a cell for each pair the report lists
 * among them. A pair of the report that involves another territory is not
 * drawn.
 */
export const matrixOf = (
  index: TerritoryIndex,
  pairs: Report["territoryCoupling"],
  limits: JudgementLimits,
): Matrix => {
  const real = index.recommended.filter(isRealTerritory);
  const rows = real
    .toSorted(byHeat)
    .slice(0, MATRIX_TERRITORIES)
    .map((territory) => rowOf(territory, limits));
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
    total: real.length,
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
