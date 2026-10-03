// Owns the entry-point part of the report contract: the ranked answer to
// where the design fails to hold up to the way the code changes, and where to
// start. Additive fields keep schemaVersion 1; renaming or removing a field bumps it.
import { Schema } from "effect";

/**
 * What kind of weakness an entry point is, each with one design move:
 * `boundary` (a territory whose boundary does not hold: move a boundary),
 * `hotspot` (chronic hotspot files in a territory: split a hotspot),
 * `clique` (territories that change as one unit: extract a shared
 * abstraction), `copies` (a family of copies that change in lockstep: extract
 * a shared abstraction), `hub` (an unstable interface: break up a hub), and
 * `coupling` (files in different territories that change together although no
 * import links them: centralize a contract).
 */
const EntryPointKind = Schema.Literals([
  "boundary",
  "hotspot",
  "clique",
  "copies",
  "hub",
  "coupling",
]);

/**
 * One place to start: where the design fails, why, and what to do about it.
 * The report lists at most ten, best first, every one with the numbers that
 * put it there.
 */
export const EntryPoint = Schema.Struct({
  /** 1 is the best place to start. */
  rank: Schema.Int.check(Schema.isGreaterThanOrEqualTo(1)),
  kind: EntryPointKind,
  /**
   * What put it on the list, in the unit of its kind (see GLOSSARY.md, "Entry
   * point (of a report)"): a share of the repository's heat for `boundary`, `hotspot`, and
   * `clique`, a share of the counted changes for `copies` and `hub`. Rounded
   * to 4 decimals; scores of different kinds are only roughly comparable, so
   * the list also keeps the best entry of each kind (see `Report.entryPoints`).
   */
  score: Schema.Finite.check(Schema.isGreaterThan(0)),
  /**
   * `id`s of the territories (see `Territories`) it concerns: the territory
   * itself for `boundary` and `hotspot`, the members of a `clique`, and the
   * territories that hold the files of `copies`, `hub`, and `coupling`.
   */
  territories: Schema.Array(Schema.String),
  /**
   * The files it concerns, sorted: the chronic hotspots of `hotspot`, the
   * members of `copies`, the file of `hub`, the two files of `coupling`; empty for `boundary` and
   * `clique`, which concern whole territories.
   */
  files: Schema.Array(Schema.String),
  /**
   * The numbers behind it by name, taken from the territory's `fit`, the
   * clique, the copy family, or the unstable interface (see GLOSSARY.md for
   * each kind's names). A number that does not exist is left out.
   */
  evidence: Schema.Record(Schema.String, Schema.Finite),
  /** One fixed sentence per kind (a variant when the territory also erodes) saying what is wrong, for a reader new to the repository. */
  verdict: Schema.String,
  /** One sentence per kind, built from a fixed template with the paths filled in, saying what to do: move a boundary, extract a shared abstraction, break up a hub, or split a hotspot. */
  designMove: Schema.String,
});
export type EntryPoint = typeof EntryPoint.Type;
