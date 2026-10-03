// Owns the unstable-interface part of the report contract: files many others
// import that keep changing, which makes every change to them a risk for many.
// Additive fields keep schemaVersion 1; renaming or removing a field bumps it.
import { Schema } from "effect";

import { Count } from "./scalars.js";

/**
 * A TypeScript or JavaScript file that many files depend on and that changes
 * often compared to them: a change to it can ripple into all of its
 * dependents. It answers the question where to start so the codebase scales:
 * stabilize the interface, or split what keeps changing from what many rely on.
 */
export const UnstableInterface = Schema.Struct({
  path: Schema.String,
  /** `path` of the file's module (see `Module`). */
  module: Schema.String,
  /**
   * Files that import it directly (the fan-in), test code left out. A file
   * that reaches it only through a re-exporting barrel does not count, so a
   * public barrel shows the fan-in of its package and the files behind it
   * show their own. Only imports the analysis can resolve to universe files
   * count (see `Coupling.imports`), so a repository that imports through
   * path aliases shows a lower fan-in than it has.
   */
  fanIn: Count,
  /** Logical changes of the window that touched the file (`FileStats.changes`): the churn of an interface is how often it was changed as a whole, not how many commits that took. */
  changes: Count,
  /** The median of `changes` over its dependents: the file changes more often than this. */
  medianDependentChanges: Count,
  /** Dependents that changed in a counted commit that also changed the file. */
  changedDependents: Count,
  /** The dependents that changed with it most often, at most five, with the counted commits they share with the file. */
  dependents: Schema.Array(
    Schema.Struct({ path: Schema.String, sharedCommits: Count }),
  ),
  /** One sentence for a reader new to the repository. */
  reason: Schema.String,
});
export type UnstableInterface = typeof UnstableInterface.Type;
