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
 * What one kind of weakness says about an entry point: the verdict, the
 * move, and the numbers behind it.
 */
const Finding = Schema.Struct({
  kind: EntryPointKind,
  /** One fixed sentence per kind (a variant when the territory also erodes) saying what is wrong, for a reader new to the repository. */
  verdict: Schema.String,
  /** One sentence per kind, built from a fixed template with the paths filled in, saying what to do: move a boundary, extract a shared abstraction, break up a hub, split a hotspot, or centralize a contract. */
  designMove: Schema.String,
  /**
   * The numbers behind it by name, taken from the territory's `fit`, the
   * clique, the copy family, the unstable interface, or the coupling (see
   * GLOSSARY.md for each kind's names). A number that does not exist is left
   * out.
   */
  evidence: Schema.Record(Schema.String, Schema.Finite),
  /** The files this finding names (a hotspot's hottest first); see `EntryPoint.files`. */
  files: Schema.Array(Schema.String),
});

/**
 * One place to start: where the design fails, why, and what to do about it.
 * The report lists at most ten, best first, every one with the numbers that
 * put it there.
 */
export const EntryPoint = Schema.Struct({
  /** 1 is the best place to start. */
  rank: Schema.Int.check(Schema.isGreaterThanOrEqualTo(1)),
  /** The kind of the primary finding, the stronger one when a territory has two. */
  kind: EntryPointKind,
  /**
   * What put it on the list: the share of all the heat (see
   * `Territory.heatShare`; the heat of a file is `FileStats.changes × (loc +
   * complexity.total)`) at stake, times how strong the weakness is, in the
   * unit of every kind, so that scores of different kinds compare as the share
   * of change effort at stake (see GLOSSARY.md, "Entry point (of a report)"
   * for each kind's rule). Rounded to 4 decimals. The score of the primary
   * finding.
   */
  score: Schema.Finite.check(Schema.isGreaterThan(0)),
  /**
   * `id`s of the territories (see `Territories`) it concerns: the territory
   * itself for `boundary` and `hotspot`, the members of a `clique`, and the
   * territories that hold the files of `copies`, `hub`, and `coupling`.
   */
  territories: Schema.Array(Schema.String),
  /**
   * The files it concerns: the chronic hotspots of a `hotspot`, the hottest
   * first, the members of `copies` (sorted), the file of `hub`, the two files of
   * `coupling`. They may be missing from `Report.files` when `--limit` cut it. Empty
   * for `boundary` and `clique`, which concern whole territories, and for a
   * territory that is both a boundary and a hotspot (its hotspot files are
   * in the finding).
   */
  files: Schema.Array(Schema.String),
  /** The numbers behind the primary finding, completed by those of the other finding of the territory. */
  evidence: Schema.Record(Schema.String, Schema.Finite),
  /** The verdict of the primary finding. */
  verdict: Schema.String,
  /** The design move of the primary finding. */
  designMove: Schema.String,
  /**
   * Every finding about the entry, the primary one (the stronger, by its score
   * among the findings) first. A territory that qualifies as both a
   * `boundary` and a `hotspot` is one entry with two findings; every other
   * entry has one, the one repeated in `kind`, `verdict`, `designMove`,
   * `evidence`, and `files`.
   */
  findings: Schema.Array(Finding),
});
export type EntryPoint = typeof EntryPoint.Type;
