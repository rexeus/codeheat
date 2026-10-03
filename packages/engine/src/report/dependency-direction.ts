// Owns the dependency-direction part of the report contract: imports that point
// from a module that rarely changes to one that changes often.
// Additive fields keep schemaVersion 1; renaming or removing a field bumps it.
import { Schema } from "effect";

import { Count } from "./scalars.js";

/**
 * An import edge between two modules that points the wrong way in the sense of
 * the Stable Dependencies Principle: code that rarely changes depends on code
 * that changes often, so every change to `to` risks `from`. Stability is
 * measured from how often each module actually changed, not from how many
 * modules depend on it. TypeScript and JavaScript only.
 */
export const DependencyDirection = Schema.Struct({
  /** `path` of the module whose files import (see `Module`). */
  from: Schema.String,
  /** `path` of the module they import. */
  to: Schema.String,
  /** Files of `from`, test code left out, that import at least one file of `to`. */
  importingFiles: Count,
  /**
   * Of those, the files that changed in a counted commit together with a file
   * of `to` that they import: where the dependency was actually felt.
   */
  changedImporters: Count,
  /** `Module.commits` of `from`. */
  fromCommits: Count,
  /** `Module.commits` of `to`; at least `Thresholds.minVolatilityRatio` times `fromCommits`, and at least `Thresholds.minModuleCommits`. */
  toCommits: Count,
  /**
   * `toCommits / max(1, fromCommits)`, rounded to 4 decimals: how much more
   * often the imported module changes than the importing one. The list ranks
   * by `log2(ratio) × log2(1 + changedImporters)`.
   */
  ratio: Schema.Finite.check(Schema.isGreaterThanOrEqualTo(1)),
  /** One sentence for a reader new to the repository. */
  reason: Schema.String,
});
export type DependencyDirection = typeof DependencyDirection.Type;
