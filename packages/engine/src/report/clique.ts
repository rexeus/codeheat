// Owns the clique part of the report contract: groups of modules that change
// together so consistently that they behave as one unit split across boundaries.
// Additive fields keep schemaVersion 1; renaming or removing a field bumps it.
import { Schema } from "effect";

import { Count, UnitInterval } from "./scalars.js";

/**
 * A maximal group of at least three ranked modules (see `Module`) of which
 * every pair shares at least `Thresholds.minCliqueShare` of the smaller
 * module's counted commits (and at least `Thresholds.minSharedCommits`
 * commits), and at least `Thresholds.minSharedCommits` commits touched all
 * members. Such modules are one unit of change cut by boundaries, or share an
 * abstraction that is missing.
 */
export const Clique = Schema.Struct({
  /** `path` of each member, at least three, sorted. */
  modules: Schema.Array(Schema.String),
  /** Counted commits that touched every member; at least `Thresholds.minSharedCommits`. */
  sharedCommits: Count,
  /** The smallest `ModuleCoupling.share` over all pairs of members; at least `Thresholds.minCliqueShare`. Rounded to 4 decimals. */
  weakestShare: UnitInterval,
  /** One sentence for a reader new to the repository: what binds the group. */
  reason: Schema.String,
});
export type Clique = typeof Clique.Type;
