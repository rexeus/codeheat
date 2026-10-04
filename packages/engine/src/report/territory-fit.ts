// Owns the design-fit part of a territory in the report contract: how well the
// area contains the changes that touch it, where they leak to, and how that
// moved. Additive fields keep schemaVersion 1; renaming or removing a field bumps it.
import { Schema } from "effect";

import { ModuleErosion } from "./erosion.js";
import { ModuleFixes } from "./fix-density.js";
import { Count, UnitInterval } from "./scalars.js";

/** The territory a territory's changes most often reach into. */
const TerritoryPartner = Schema.Struct({
  /** `id` of the other territory, one of those visible at `TerritoryFit.detail`. */
  territory: Schema.String,
  /** Counted changes that touched both territories; at least `Thresholds.minSharedCommits`. */
  sharedChanges: Count,
  /** `sharedChanges` over the changes that touched this territory, rounded to 4 decimals: how likely a change here reaches the partner. */
  share: UnitInterval,
});

/**
 * What the changes of the window say about one territory, measured with the
 * same rules as the modules' numbers (`Module.cohesion`, `Module.radius`,
 * `Module.erosion`, `Module.fixDensity`, `Report.cliques`,
 * `Report.distantCouplings`) over the territories visible at `detail`, so
 * that every territory is measured once and every detail refers to the
 * result. A change touches a territory when it touched any of its files; test
 * code counts for the territory it belongs to, `tests` territories take no
 * part, and contract files, which belong to no territory, are ignored.
 */
export const TerritoryFit = Schema.Struct({
  /**
   * The detail whose territories the boundary measures (`radius`, `partner`,
   * `cliques`, and the distant pairs' crossing) are taken against: the detail
   * at which this territory is visible that lies closest to
   * `Territories.recommended`. A territory that splits further is measured against the last detail before
   * it splits, a finer one against its first. Everything else here does not
   * depend on it.
   */
  detail: Schema.Int.check(Schema.isGreaterThanOrEqualTo(1)),
  /**
   * The share of the changes that touched the territory and touched no other
   * territory of `detail` (`Module.cohesion` for territories), rounded to 4
   * decimals; null when no counted change touched it and for `tests`
   * territories. Low means its boundary does not hold: changes keep reaching
   * out.
   */
  containment: Schema.NullOr(UnitInterval),
  /**
   * The median number of territories at `detail`, itself included, that the
   * changes touching it touched (`Module.radius` for territories); null where
   * `containment` is.
   */
  radius: Schema.NullOr(Schema.Int.check(Schema.isGreaterThanOrEqualTo(1))),
  /**
   * The territory at `detail` that shares the most counted changes with this
   * one (at least `Thresholds.minSharedCommits`), ties by `id`; null when
   * none does, and for a territory with fewer than `Thresholds.minModuleCommits`
   * changes or an `other` one.
   */
  partner: Schema.NullOr(TerritoryPartner),
  /**
   * Coupled pairs of files (`Report.couplings`) of which one file is in this
   * territory and the other in another territory of `detail`, neither
   * test code, not two contract files: changes that cross the boundary
   * file by file.
   */
  distantPairs: Count,
  /** Of those, the pairs no import links (`Coupling.imports` is `none`): coupling the code does not show. */
  hiddenPairs: Count,
  /**
   * Cliques (see `Clique`) of the territories at `detail` that this territory
   * belongs to: groups of three or more that change as one unit across their
   * boundaries.
   */
  cliques: Count,
  /**
   * How the territory's containment moved over `Report.series` (see
   * `ModuleErosion`, which reads `containment` where it says cohesion); null
   * for a `tests` territory and without evidence in enough windows.
   */
  erosion: Schema.NullOr(ModuleErosion),
  /** Files of the territory that are chronic hotspots (`FileStats.heat`). */
  chronicFiles: Count,
  /** Files of the territory that are acute hotspots. */
  acuteFiles: Count,
  /**
   * The share of the heat of the territory's code (test code left out; the
   * heat of a file is `FileStats.changes × (loc + complexity.total)`) that
   * lies in its chronic hotspots, rounded to 4 decimals: how much of the work
   * here is the long-lived, not the passing kind.
   */
  chronicShare: UnitInterval,
  /** The fixes among the counted changes that touched the territory (see `FixDensity`); null unless `Report.fixDensity` is `known`, and where none touched it. */
  fixDensity: Schema.NullOr(ModuleFixes),
});
export type TerritoryFit = typeof TerritoryFit.Type;
