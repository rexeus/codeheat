// Owns the sizes of an analysis before any output limit.
// Additive fields keep schemaVersion 1; renaming or removing a field bumps it.
import { Schema } from "effect";

import { Count } from "./scalars.js";

/** Sizes before any output limit, so truncated reports keep their context. */
export const Totals = Schema.Struct({
  /** Code files that are no test code, the ones in `files`. */
  files: Count,
  /** Code files that are test code, the ones in `testCode`. */
  testCode: Count,
  /** Contract files, the ones in `contracts`. */
  contracts: Count,
  couplings: Count,
  modules: Count,
  /**
   * Tracked files named like code or a contract (and not removed by
   * `--exclude`) that the universe leaves out as generated: below a
   * generated or vendored directory (`dist`, `build`, `vendor`,
   * `node_modules`, `generated`, `__generated__`, `tsp-output`), minified by
   * name (`.min.`), marked `linguist-generated` or `linguist-vendored`, or
   * whose content is binary, minified, or larger than
   * `Thresholds.maxFileBytes`. A file missing from the work tree or holding
   * only whitespace is left out without counting here.
   */
  generated: Count,
});
