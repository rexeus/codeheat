// Owns the basis of report v2: the limits behind the answer, what the counts
// leave out, and what the listed areas do not show.
import { Schema } from "effect";

import { Count, Percent, Share } from "./scalars.js";

/** The limits the answer applies. */
const Thresholds = Schema.Struct({
  /** An area leaks when at most this share of its changes stays inside. */
  leaksAtStays: Share,
  /** Fewest changes an area needs to be judged. */
  judgedFromChanges: Count,
  /** Percent of the heat in leaking areas from which the answer is `mixed`. */
  mixedFromLeakingHeat: Percent,
  /** Percent of the heat in leaking areas from which the answer is `strained`. */
  strainedFromLeakingHeat: Percent,
  /** Percent of the heat the judged areas must hold for the answer to have a level. */
  judgedHeatNeeded: Percent,
  /** Fewest shared changes that make two files, or two areas, a pair. */
  pairFromChanges: Count,
  /** Fewest shared changes over the two files' mean changes that make a pair of files. */
  pairFromStrength: Share,
  /** A change of more files is left out of every count. */
  maxChangeFiles: Count,
  /** Fewer changes in the window make the evidence `thin`. */
  thinBelowChanges: Count,
  /** Fewer judged areas make the evidence `thin`. */
  thinBelowAreas: Count,
});

/** What the window's numbers leave out. */
const Excluded = Schema.Struct({
  /** Commits that change no behavior: renames, whitespace, reverted pairs, duplicates, and those listed in `.git-blame-ignore-revs`. */
  mechanicalCommits: Count,
  /** Changes of more than `thresholds.maxChangeFiles` files. */
  largeChanges: Count,
  /** Tracked files named like code that are generated, vendored, minified, binary, or too large to read. */
  generated: Count,
});

/** What the listed areas do not show. */
const Rest = Schema.Struct({
  /** Areas that are not listed: not judged, under 1 percent of the heat, and named nowhere. */
  areas: Count,
  /** Their production code files, with those of folders too small to be areas and loose files. */
  files: Count,
  /** Percent of all the heat in them; with `areas[].heat`, it adds up to exactly 100 (0 without any heat). */
  heat: Percent,
  /**
   * The unlisted part with the most heat, ties by path: the loose files of a
   * directory (`path` is the directory), a bucket of smaller folders (the
   * directory they are in), test code of no area, or an area; null when
   * every part is listed. Its `heat` is at most `rest.heat`.
   */
  largest: Schema.NullOr(Schema.Struct({ path: Schema.String, heat: Percent })),
});

/** The limits behind the answer, what the counts leave out, and the rest. */
export const Basis = Schema.Struct({
  thresholds: Thresholds,
  excluded: Excluded,
  rest: Rest,
});
export type Basis = typeof Basis.Type;
