// Owns the versioned `inspect` result: files in focus with their co-change partners.
// It reuses the report's shapes so a file reads the same in both documents.
// Additive fields keep schemaVersion 1; renaming or removing a field bumps it.
import { Schema } from "effect";

import { AnalysisWindow, Count, FileStats, UnitInterval } from "./report.js";

/** A file that changes together with an inspected file. */
const Partner = Schema.Struct({
  path: Schema.String,
  sharedCommits: Count,
  /** `sharedCommits / revisions(inspected file)`: how likely a change here also changes the partner. */
  probability: UnitInterval,
  testPair: Schema.Boolean,
});

/** One inspected file with its standing in the whole universe. */
const InspectEntry = Schema.Struct({
  ...FileStats.fields,
  /** Universe size, so `rank` reads as "rank of N". */
  of: Count,
  /** Sorted by probability, descending; at most ten. */
  partners: Schema.Array(Partner),
});

/** The result of `inspect`. */
export const InspectResult = Schema.Struct({
  schemaVersion: Schema.Literal(1),
  window: AnalysisWindow,
  /** Sorted by rank. */
  matches: Schema.Array(InspectEntry),
  /** Requested paths or globs that matched no universe file. */
  unmatched: Schema.Array(Schema.String),
});
export type InspectResult = typeof InspectResult.Type;
