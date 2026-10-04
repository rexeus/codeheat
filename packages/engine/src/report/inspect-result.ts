// Owns the versioned `inspect` result: files in focus with their co-change partners.
// It reuses the report's shapes so a file reads the same in both documents.
// Additive fields keep schemaVersion 1; renaming or removing a field bumps it.
import { Schema } from "effect";

import { AnalysisWindow } from "./analysis-window.js";
import { FileKind } from "./contract-file.js";
import { CopyFamily } from "./copy-family.js";
import { EntryPoint } from "./entry-point.js";
import { Module } from "./module.js";
import { FileStats } from "./report.js";
import { Count, UnitInterval } from "./scalars.js";
import { Territory } from "./territory.js";

/** A file that changes together with an inspected file. */
const Partner = Schema.Struct({
  path: Schema.String,
  sharedCommits: Count,
  /** `sharedCommits / changes(inspected file)` (see `FileStats.changes`): how likely a change here also changes the partner; rounded to 4 decimals. */
  probability: UnitInterval,
  /** What the partner is; a contract has no score and is listed in `Report.contracts`. */
  kind: FileKind,
  testPair: Schema.Boolean,
  /** The partner belongs to a different module than the inspected file. */
  crossesModule: Schema.Boolean,
  /**
   * The pair is a distant coupling (see `Report.distantCouplings`): the files
   * lie in different modules or far apart within one, neither is test code,
   * and they are not two contract files. A distant partner is a hint that the
   * change reaches across a design boundary.
   */
  distant: Schema.Boolean,
  /**
   * `Coupling.imports` seen from the inspected file: `file→partner` means the
   * inspected file imports the partner. `none` is hidden coupling; null when
   * the relation is unknown.
   */
  imports: Schema.NullOr(
    Schema.Literals(["file→partner", "partner→file", "both", "none"]),
  ),
});

/** One inspected file with its standing in the whole universe. */
const InspectEntry = Schema.Struct({
  ...FileStats.fields,
  /** Universe size, so `rank` reads as "rank of N". */
  of: Count,
  /** Sorted by probability, descending; at most ten. */
  partners: Schema.Array(Partner),
  /**
   * The copy family the file belongs to (see `Report.copyFamilies`): its
   * copies and how often they changed in lockstep; null for a file that is no
   * member.
   */
  copyFamily: Schema.NullOr(CopyFamily),
  /**
   * The entry points of the report the file belongs to, best first (see
   * `Report.entryPoints`): one that names files concerns exactly those, one
   * that names none (`boundary`, `clique`) every file in its territories.
   * Empty for a file that is part of none.
   */
  entryPoints: Schema.Array(EntryPoint),
});

/** The result of `inspect`. */
export const InspectResult = Schema.Struct({
  schemaVersion: Schema.Literal(1),
  window: AnalysisWindow,
  /** Sorted by rank. */
  matches: Schema.Array(InspectEntry),
  /** The modules of the matched files, in report order: where a change would land and what it tends to pull in. */
  modules: Schema.Array(Module),
  /**
   * The territories of the matched files (`FileStats.territory`, the finest one
   * of each), the territory that holds each of them that is a `tests`
   * territory (test code has no fit), and the partners of their fit
   * (`TerritoryFit.partner`), as they
   * stand in `Report.territories`, in report order: how well the file's area
   * holds up to the way the code changes, for the files that are in no entry
   * point too.
   */
  territories: Schema.Array(Territory),
  /**
   * Contract files the patterns matched, sorted. A contract has no score and
   * no entry in `matches`: inspect the code that changes with it, which lists
   * the contract among its partners.
   */
  contractFiles: Schema.Array(Schema.String),
  /** Requested paths or globs that matched no universe file; one that matched only contract files is not listed here. */
  unmatched: Schema.Array(Schema.String),
});
export type InspectResult = typeof InspectResult.Type;
