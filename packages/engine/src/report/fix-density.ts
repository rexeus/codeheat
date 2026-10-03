// Owns the fix-density part of the report contract: how many of the changes
// are fixes, for the repository and for each module, when commit subjects
// tell.
// Additive fields keep schemaVersion 1; renaming or removing a field bumps it.
import { Schema } from "effect";

import { Count, UnitInterval } from "./scalars.js";

/**
 * Which counted changes of the window (see `Report.logicalChanges`) are fixes,
 * read from the subjects of their commits: `fix`, `hotfix`, `bugfix`, or
 * `revert` as the type of a Conventional Commit (`fix(scope)!: …`), a subject
 * that starts with `Revert "`, or one whose first word is `fix`, `fixes`,
 * `fixed`, `fixing`, `bug`, `bugfix`, or `hotfix` (`bug` followed by a
 * ticket number, as in `Bug 1234 - …` or `BUG-12`, names a ticket and is no
 * fix). A change of several commits is a fix when more than half of its
 * commits are. When too few subjects say anything, a share of 0 would be a
 * claim: then the fix density is unknown.
 */
export const FixDensity = Schema.Struct({
  /** Counted changes that were read. */
  changes: Count,
  /** Of those, the fixes. */
  fixes: Count,
  /**
   * Share of the changes whose subject matches a fix rule above or is another
   * Conventional Commits type such as `feat:` or `chore(deps):`, rounded to 4
   * decimals; 0 without changes. A team that writes free text but often starts
   * with "Fix" counts here too.
   */
  conventional: UnitInterval,
  /** `conventional` is at least `Thresholds.minConventionShare`: enough subjects say what a change is. */
  known: Schema.Boolean,
  /** `fixes / changes`, rounded to 4 decimals; null unless `known`. */
  share: Schema.NullOr(UnitInterval),
});
export type FixDensity = typeof FixDensity.Type;

/**
 * The fixes among the counted changes that touched a module, when
 * `Report.fixDensity` is `known`.
 */
export const ModuleFixes = Schema.Struct({
  /** Counted fixes that touched the module. */
  fixes: Count,
  /** `fixes / Module.commits`, rounded to 4 decimals. */
  share: UnitInterval,
  /**
   * Of the fixes, those that also touched another module that is not
   * test-only: a fix that reaches across a boundary marks the boundary as
   * fragile.
   */
  spanning: Count,
});
export type ModuleFixes = typeof ModuleFixes.Type;
