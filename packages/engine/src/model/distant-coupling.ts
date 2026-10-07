// Owns the distant-coupling part of the report contract: file pairs that keep
// changing together across module boundaries or far apart within one.
// Additive fields keep schemaVersion 1; renaming or removing a field bumps it.
import { Schema } from "effect";

import { ImportRelation } from "./import-relation.js";
import { Count, UnitInterval } from "./scalars.js";

/**
 * A coupled pair of code or contract files that lie far apart in the design:
 * in different modules, or in directories at least `Thresholds.minLocalDistance`
 * hops apart within one module. Pairs with a test-code file and pairs of two
 * contract files are never listed. A modularity violation in the sense of Mo,
 * Cai, and Kazman: structurally distant files that change together.
 */
export const DistantCoupling = Schema.Struct({
  a: Schema.String,
  b: Schema.String,
  /** Counted changes that touched both files. */
  sharedCommits: Count,
  /** `Coupling.degree` of the pair: how tightly the two change together. */
  strength: UnitInterval,
  /** Directory hops between the two files (`Coupling.distance`). */
  distance: Count,
  /** The files belong to different modules. */
  crossesModule: Schema.Boolean,
  /** `path` of each file's module (see `Module`), also when they are the same. */
  modules: Schema.Struct({ a: Schema.String, b: Schema.String }),
  /** `Coupling.imports`: `none` is hidden coupling, null is unknown. */
  imports: ImportRelation,
  /**
   * `strength × reach × hidden × evidence`, rounded to 4 decimals. `reach` is
   * `1 + log2(1 + hops)` between the two modules' directories for a pair that
   * crosses modules (at least 2.58, growing slowly so that deeply nested paths
   * do not dominate), and `distance` over the largest distance among the
   * distant pairs for a pair within one module (at most 1): a module boundary
   * is a design statement, directory steps only order what stays inside one.
   * `hidden` is 1.5 when no import links the files (`imports` is `none`) and 1
   * otherwise, null included. `evidence` is `min(1, sharedCommits / 10)`, so a
   * pair that met in three changes does not outrank one that met in eleven at
   * a similar degree.
   */
  score: Schema.Finite.check(Schema.isGreaterThanOrEqualTo(0)),
});
export type DistantCoupling = typeof DistantCoupling.Type;
