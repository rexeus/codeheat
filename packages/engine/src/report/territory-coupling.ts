// Owns the territory coupling part of the report contract: how often the
// territories at the recommended detail change in the same changes, and which
// of them change as one unit. v2 will move these under `coupling`.
// Additive fields keep schemaVersion 1; renaming or removing a field bumps it.
import { Schema } from "effect";

import { Count, UnitInterval } from "./scalars.js";

/**
 * Two of the `Thresholds.maxCoupledTerritories` (24) hottest real territories
 * (package, folder, or group; never `other` or `tests`) at
 * `Territories.recommended` that change in the same counted changes: the data of
 * a territory matrix. A change touches a territory when it touched any of its
 * files (the rule of `TerritoryFit`, counted by the same code as
 * `TerritoryFit.partner`, so the `partner` of a territory among those hottest
 * is among its pairs with the same `sharedChanges`, unless the partner lies
 * beyond them: a territory further down the ranking, which the recommended
 * detail allows, is not covered). Only pairs of territories with at least
 * `Thresholds.minModuleCommits` changes each that share at least
 * `Thresholds.minSharedCommits` changes are listed; coupled file pairs between
 * two other territories are not.
 */
export const TerritoryCoupling = Schema.Struct({
  /** `id` of the territory of the pair that sorts first by id (string order); each pair is listed once. */
  a: Schema.String,
  /** `id` of the other territory. */
  b: Schema.String,
  /** Counted changes that touched both territories; at least `Thresholds.minSharedCommits`. */
  sharedChanges: Count,
  /** Coupled file pairs (`Report.couplings`) of which one file lies in `a` and the other in `b`, neither test code, not two contract files (the rule of `TerritoryFit.distantPairs`). */
  distantPairs: Count,
  /** Of those, the pairs no import links (`Coupling.imports` is `none`). */
  hiddenPairs: Count,
});
export type TerritoryCoupling = typeof TerritoryCoupling.Type;

/**
 * Territories at `Territories.recommended` that change as one unit across
 * their boundaries: three or more of which every pair shares at least
 * `Thresholds.minCliqueShare` of the smaller territory's counted changes (and
 * at least `Thresholds.minSharedCommits` changes), and at least
 * `Thresholds.minSharedCommits` changes touched all members (the rule of
 * `Clique`, over territories instead of modules). The numbers are the
 * evidence of an entry point of kind `clique`, which is read from the same
 * list; the cliques listed here are all that qualify, at most 50, not only the
 * ones that became entry points.
 */
export const TerritoryClique = Schema.Struct({
  /** `id` of each member, at least three, sorted. */
  territories: Schema.Array(Schema.String),
  /** Counted changes that touched every member; at least `Thresholds.minSharedCommits`. */
  sharedChanges: Count,
  /** The smallest share over all pairs of members of the smaller territory's changes that touched both, rounded to 4 decimals. */
  weakestShare: UnitInterval,
  /** The sum of `Territory.heatShare` over the members, rounded to 4 decimals. */
  heatShare: UnitInterval,
  /** The share of all the production code's heat (test code left out of the total and of the members) that the members hold, rounded to 4 decimals. */
  codeHeatShare: UnitInterval,
});
export type TerritoryClique = typeof TerritoryClique.Type;
