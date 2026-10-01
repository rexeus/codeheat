// Owns the module part of the report contract: how well each module keeps its changes to itself.
// A module is a workspace package (a directory with its own manifest) or, outside packages, a directory.
// Additive fields keep schemaVersion 1; renaming or removing a field bumps it.
import { Schema } from "effect";

import { Count, UnitInterval } from "./scalars.js";

/** Another module that changes in the same commits. */
const ModulePartner = Schema.Struct({
  /** The partner module's `path`. */
  path: Schema.String,
  /** Counted commits that touched both modules. */
  sharedCommits: Count,
});

/** A unit of the codebase and how self-contained its changes are. */
export const Module = Schema.Struct({
  /** Repository-relative POSIX directory; "." for files at the repository root. */
  path: Schema.String,
  /** `package`: the directory has its own manifest (`package.json`, `go.mod`, …); `directory`: fallback grouping. */
  kind: Schema.Literals(["package", "directory"]),
  /** Universe files in the module. */
  files: Count,
  /** Counted commits (at most `Thresholds.maxCommitFiles` files) that touched the module. */
  commits: Count,
  /** Of those, commits that touched no universe file outside the module. */
  localCommits: Count,
  /** `localCommits / commits`, rounded to 4 decimals; null when no counted commit touched the module. */
  cohesion: Schema.NullOr(UnitInterval),
  /** Modules it changes with, most shared commits first; at most five. */
  partners: Schema.Array(ModulePartner),
});
export type Module = typeof Module.Type;
