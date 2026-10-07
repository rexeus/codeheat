// Owns the basis of report v2: the limits behind the answer and what the
// counts leave out.
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

/** The limits behind the answer and what the counts leave out. */
export const Basis = Schema.Struct({
  thresholds: Thresholds,
  excluded: Excluded,
});
export type Basis = typeof Basis.Type;
