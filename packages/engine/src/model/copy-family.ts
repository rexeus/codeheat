// Owns the copy-family part of the report contract: groups of files with largely the same content that keep changing together.
// Additive fields keep schemaVersion 1; renaming or removing a field bumps it.
import { Schema } from "effect";

import { Count, UnitInterval } from "./scalars.js";

/**
 * Files whose content is largely the same and that change in the same
 * logical changes: the same change applied to several copies. They are real
 * duplication but may be intended (one adapter per entity, a template per
 * environment); the family says they change in lockstep, not that anything is
 * wrong.
 */
export const CopyFamily = Schema.Struct({
  /** At least two repository-relative paths, sorted. */
  files: Schema.Array(Schema.String),
  /**
   * The weakest and the strongest content similarity (Jaccard index over
   * shingles of five consecutive words, see `Thresholds.minCopySimilarity`)
   * over every pair of members, coupled or not; rounded to 4 decimals. The
   * family is connected through pairs at least that alike, so `min` can lie
   * below `Thresholds.minCopySimilarity`: two members may share little.
   */
  similarity: Schema.Struct({ min: UnitInterval, max: UnitInterval }),
  /** Counted changes that touched at least two members. */
  sharedChanges: Count,
  /** Counted changes that touched every member: the fixes applied to all copies. */
  changesToAll: Count,
});
export type CopyFamily = typeof CopyFamily.Type;
