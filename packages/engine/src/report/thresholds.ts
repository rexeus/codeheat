// Owns the thresholds part of the report contract: the noise limits an analysis applied.
// Additive fields keep schemaVersion 1; renaming or removing a field bumps it.
import { Schema } from "effect";

import { Count, UnitInterval } from "./scalars.js";

/** The noise limits an analysis applied, reported so consumers see them. */
export const Thresholds = Schema.Struct({
  maxCommitFiles: Count,
  /** Fewest distinct co-changed files (`FileStats.breadth`) that make a file a hub. */
  hubMinBreadth: Count,
  /** Fewest logical changes (`FileStats.changes`) a file needs to be a hub candidate; test files are never candidates. */
  hubMinRevisions: Count,
  /** Share of the hub candidates that may be hubs: widest candidate files first, ties included. */
  hubTopShare: UnitInterval,
  /** Fewest shared changes (`Coupling.sharedCommits`) that make a coupling. */
  minSharedCommits: Count,
  minDegree: UnitInterval,
  /**
   * Fewest counted changes (`Module.commits`) a module needs to be ranked as (in)cohesive:
   * `max(5, ceil(0.01 × window.couplingCommits))`, so the floor grows with the window.
   */
  minModuleCommits: Count,
  /** Fewest directory hops (`Coupling.distance`) at which two files of one module are a distant coupling; files of different modules always are. */
  minLocalDistance: Count,
  /**
   * Smallest `Partner.probability` at which a partner that no import links to
   * the file (hidden coupling) gets a reason line.
   */
  minHiddenProbability: UnitInterval,
  /** Smallest content similarity (`CopyFamily.similarity`) at which two coupled files belong to one copy family. */
  minCopySimilarity: UnitInterval,
  /** Smallest `Module.leakage` at which a module's entry points get a reason line. */
  minLeakage: UnitInterval,
  /** Fewest `Module.implementationCommits` a module needs before its entry points get that reason line. */
  minImplementationCommits: Count,
  /**
   * A contract file that changed in more than this share of the counted
   * changes is ubiquitous (see `Report.ubiquitousFiles`).
   */
  ubiquitousShare: UnitInterval,
  /** Fewest counted changes a contract file needs to be ubiquitous. */
  ubiquitousMinCommits: Count,
  maxMeanLineLength: Count,
  maxFileBytes: Count,
});
