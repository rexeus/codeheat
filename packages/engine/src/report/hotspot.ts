// Owns the hotspots of report v2: the production files that hold the most
// change effort.
import { Schema } from "effect";

import { Count, Percent } from "./scalars.js";

/** One production file among those with the most heat. */
export const Hotspot = Schema.Struct({
  /** Repository-relative POSIX path. */
  path: Schema.String,
  /** The `path` of the listed area that holds the file; null for a file in `basis.rest`. */
  area: Schema.NullOr(Schema.String),
  /** Percent of all the heat: the file's changes × (lines + complexity), over the heat of every file. */
  heat: Percent,
  /** Changes (`window.changes`) that touched the file. */
  changes: Count,
  /** Non-blank lines. */
  lines: Count,
  /** Indentation complexity, summed over the file's lines. */
  complexity: Count,
  /** The file has been among the hottest for most of the last quarters, not only lately. */
  chronic: Schema.Boolean,
});
export type Hotspot = typeof Hotspot.Type;
