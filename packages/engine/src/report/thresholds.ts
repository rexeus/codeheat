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
  /** Smallest share of the smaller module's counted commits that every pair of a clique (`Report.cliques`) shares. */
  minCliqueShare: UnitInterval,
  /** Fewest dependents (`UnstableInterface.fanIn`) that make a file an interface many rely on. */
  minFanIn: Count,
  /** Fewest revisions a file needs to be an unstable interface. */
  minInterfaceChanges: Count,
  /** How many times as many counted commits as an importing module the imported one needs to be flagged in `Report.dependencyDirection`. */
  minVolatilityRatio: Count,
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
  /** Longest chain of couplings (`Report.couplings`, at least `minSharedCommits` shared changes and `minDegree`) that `Report.propagationCost` follows from a file. */
  propagationDepth: Count,
  /**
   * A contract file that changed in more than this share of the counted
   * changes is ubiquitous (see `Report.ubiquitousFiles`).
   */
  ubiquitousShare: UnitInterval,
  /** Fewest counted changes a contract file needs to be ubiquitous. */
  ubiquitousMinCommits: Count,
  /** Fewest counted changes a window of `Report.series` needs to be `active`, which is what the erosion, trend, and heat classifications count, and the fewest changes a module needs in a window for that window to count towards its `ModuleErosion` (at least what `minModuleCommits` is for a window of that size). */
  minWindowChanges: Count,
  /** Fewest windows with evidence a trend (`Erosion`, `ModuleErosion`) is fitted through. */
  minTrendWindows: Count,
  /** How far the fitted locality (`Erosion.locality`) must move, as a share of the changes, for the verdict to be `eroding` or `improving`; it must also move by `minErosionSigmas` standard errors. */
  minErosionShift: UnitInterval,
  /** Fewest windows with evidence a verdict of `eroding` or `improving` needs, so that it can be checked without the first and the last (`Erosion.verdict`); with fewer it is `holding`. */
  minVerdictWindows: Count,
  /** How many standard errors of the shift (from the windows' binomial variances, see `Erosion.verdict`) a fitted line must move to count as eroding or improving, for the repository and for a module. */
  minErosionSigmas: Count,
  /** Share of the files with revisions in a window of `Report.series` that are hot in it (see `Heat`). */
  hotTopShare: UnitInterval,
  /** Smallest share of the counted changes whose subject must match a fix rule or be a Conventional Commits type (`FixDensity.conventional`) for `Report.fixDensity` to be known; below it the fix density is unknown, not 0. */
  minConventionShare: UnitInterval,
  /** Smallest share of all the production code's heat a territory (or the members of a clique) needs to be an entry point (`Report.entryPoints`). */
  minEntryHeatShare: UnitInterval,
  /** A territory is a `boundary` entry point only when at most this share of the changes touching it stay inside it (`TerritoryFit.containment`). */
  maxEntryContainment: UnitInterval,
  /** Smallest `TerritoryFit.chronicShare` at which a territory is chronic: a `hotspot` entry point, and a `boundary` one ranks higher. */
  minEntryChronicShare: UnitInterval,
  /** Fewest changes that touched every copy of a family (`CopyFamily.changesToAll`), and fewest dependents that changed with an unstable interface (`UnstableInterface.changedDependents`), for a `copies` or `hub` entry point. */
  minEntryChanges: Count,
  /** Fewest shared changes (`Coupling.sharedCommits`) of a hidden coupling for a `coupling` entry point. */
  minEntryCouplingChanges: Count,
  /** Smallest `EntryPoint.score` an entry point needs, as a share of all the production code's heat at stake (0.005 is half a percent of the change effort); the best entry of each kind is exempt. */
  minEntryScore: UnitInterval,
  /** Most entry points of one kind (counting a territory that is both a boundary and a hotspot once, under its stronger kind). */
  maxEntriesPerKind: Count,
  /** Most entry points in the report. */
  maxEntries: Count,
  /** Most territories the territory matrix covers (`Report.territoryCoupling`): the hottest real ones at the recommended detail. */
  maxCoupledTerritories: Count,
  /** Smallest share of all the heat the judged territories must hold for `Report.verdict` to have a level (see `Verdict`). */
  minVerdictCoverage: UnitInterval,
  /** Smallest share of all the heat in leaking territories at which `Report.verdict` holds only in parts (`mixed`). */
  minMixedLeakShare: UnitInterval,
  /** Smallest share of all the heat in leaking territories at which `Report.verdict` is under strain (`strained`). */
  minStrainedLeakShare: UnitInterval,
  maxMeanLineLength: Count,
  maxFileBytes: Count,
});
