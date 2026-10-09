// Owns what the analysis model says about the exclude patterns it applied.
// Additive fields keep schemaVersion 1; renaming or removing a field bumps it.
import { Schema } from "effect";

import { Count } from "./scalars.js";

/** Where an exclude pattern comes from: `default` for the default list (dropped by `--no-default-excludes`), `user` for `--exclude`. */
export const ExcludeSource = Schema.Literals(["default", "user"]);

/** One exclude pattern the analysis applied, with the files it left out. */
export const ExcludeCount = Schema.Struct({
  /** A repository-relative glob or exact path. */
  pattern: Schema.String,
  source: ExcludeSource,
  /**
   * Tracked files named like code or a contract (the language and contract
   * lists, or `--include`) that the pattern left out. A file several patterns
   * match counts for the first of them in `Analysis.excludes`, so the counts
   * add up to the files left out by name.
   */
  files: Count,
});
