// Owns the clique part of the report contract: groups of modules that change
// together so consistently that they behave as one unit split across boundaries.
// Additive fields keep schemaVersion 1; renaming or removing a field bumps it.
import { Schema } from "effect";

import { Count, UnitInterval } from "./scalars.js";

/**
 * A maximal group of at least three ranked modules (see `Module`) of which
 * every pair shares at least `Thresholds.minCliqueShare` of the smaller
 * module's counted changes (and at least `Thresholds.minSharedCommits`
 * changes), and at least `Thresholds.minSharedCommits` changes touched all
 * members. Such modules are one unit of change cut by boundaries, or share an
 * abstraction that is missing.
 *
 * `Analysis.cliques` lists distinct units: a group inside another is left out,
 * and two groups that are variants of one unit (their union pairwise linked in
 * the module pair graph, and at least `min(n − 1, ceil(0.8 n))` members in
 * common, `n` being the size of the larger) are reported once, as the stronger
 * (more `sharedCommits`, then more members, then path). Groups whose other
 * members never change together stay separate however much they overlap.
 */
export const Clique = Schema.Struct({
  /** `path` of each member, at least three, sorted. */
  modules: Schema.Array(Schema.String),
  /** Counted changes that touched every member; at least `Thresholds.minSharedCommits`. */
  sharedCommits: Count,
  /** The smallest `ModuleCoupling.share` over all pairs of members; at least `Thresholds.minCliqueShare`. Rounded to 4 decimals. */
  weakestShare: UnitInterval,
  /** One sentence for a reader new to the repository: what binds the group. */
  reason: Schema.String,
});
export type Clique = typeof Clique.Type;
