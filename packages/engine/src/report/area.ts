// Owns the areas of report v2: the parts of the code the answer judges, with
// how much of the change effort each holds and whether it contains it.
import { Schema } from "effect";

import { Count, Percent, Share } from "./scalars.js";

/**
 * One area of the code: a package, a folder, sibling folders that change
 * together, or the loose files of a directory whose folders are areas of
 * their own (from 1% of all the heat on), at the detail codeheat recommends reading. Areas do not overlap.
 */
export const Area = Schema.Struct({
  /**
   * Repository-relative POSIX directory; "." for the whole repository. Sibling
   * folders that change together are one brace glob over the directory they
   * share (`packages/a/{x,y}`, `{apps,lib}` at the root). The loose files of
   * a directory are the glob of what they hold (`packages/core/src/*`, `*` at
   * the repository root: the files directly in it and those of folders too
   * small to be areas), and their `description` starts with `files in`. No
   * two areas, and no area and the largest part of `basis.rest`, share a
   * path. Every area name the report uses elsewhere is the `path` of a listed
   * area.
   */
  path: Schema.String,
  /**
   * One printable line of at most 160 characters: the description of the
   * area's manifest, else the first describing sentence of its README, else
   * `main files: a, b, c`.
   */
  description: Schema.String,
  /** Code files in the area (test code is in no area). */
  files: Count,
  /** Changes (`window.changes`) that touched any file of the area. */
  changes: Count,
  /**
   * Percent of all the heat that sits in the area.
   * The heat of a file is its changes × (lines + complexity).
   */
  heat: Percent,
  /**
   * Of the changes that touched the area, the share that touched no other
   * area; null for an area that is not judged, and `note` says why. An area
   * leaks when at most `basis.thresholds.leaksAtStays` stays inside.
   */
  stays: Schema.NullOr(Share),
  /**
   * Why `stays` is null, present exactly then. `few-changes`: fewer than
   * `basis.thresholds.judgedFromChanges` changes. `no-partner`: the area keeps
   * little inside, but no other area shares `pairFromChanges` changes with it,
   * so nothing says where it leaks.
   */
  note: Schema.optionalKey(Schema.Literals(["few-changes", "no-partner"])),
  /** Where a leaking area's changes go most: the other area and the changes the two share. Present only for a leaking area. */
  leaksInto: Schema.optionalKey(
    Schema.Struct({ path: Schema.String, changes: Count }),
  ),
  /** How `stays` moved over the last quarters, present only when it clearly moved. */
  trend: Schema.optionalKey(Schema.Literals(["eroding", "improving"])),
  /** Files of the area that have been among the hottest for most of the last quarters (chronic hotspots); present only when there are any. */
  hotspots: Schema.optionalKey(
    Schema.Int.check(Schema.isGreaterThanOrEqualTo(1)),
  ),
});
export type Area = typeof Area.Type;
