// Owns the territory part of the report contract: a tree of non-overlapping
// areas of the code, each with a one-line description and the reason it splits.
// Additive fields keep schemaVersion 1; renaming or removing a field bumps it.
import { Schema } from "effect";

import { Count, UnitInterval } from "./scalars.js";
import { TerritoryFit } from "./territory-fit.js";

/**
 * What a territory is. `package`: a directory with its own manifest
 * (`package.json`, `go.mod`, `Cargo.toml`, …). `folder`: any other directory.
 * `group`: sibling folders that keep changing in the same changes and stay
 * together, `path` joins their directories with ` + `. `other`: files that
 * belong to no territory of their own, either the loose files of a directory
 * or a bucket of smaller folders that wait for a finer detail; never a real
 * territory. `tests`: test code shown apart from the code: test code that
 * belongs to no code, or that belongs to code split into several territories
 * (a `tests` child of the territory that holds them all); test code that pairs
 * with code, or belongs to code in one territory, counts for that territory.
 */
const TerritoryKind = Schema.Literals([
  "package",
  "folder",
  "group",
  "other",
  "tests",
]);

/** One area of the code, a node of the territory tree. */
export const Territory = Schema.Struct({
  /** Identifies the node within this report (`t1`, `t2`, …, in tree order); it carries no meaning across reports. */
  id: Schema.String,
  /**
   * Repository-relative POSIX directory; "." for the whole repository (the root of the tree), or the package that holds every file. A `group` joins its
   * directories with ` + `. An `other` node of loose files names the directory
   * they are in, a bucket the directory its folders are in; its `parent` and `kind` tell it
   * from the territory of that directory.
   */
  path: Schema.String,
  kind: TerritoryKind,
  /** `id` of the territory this one splits from; null for the root. */
  parent: Schema.NullOr(Schema.String),
  /** `id`s of the territories it splits into, real territories first, then `tests`, then `other`; empty when it does not split. */
  children: Schema.Array(Schema.String),
  /** Code files in the territory, test code that belongs to its code included. */
  files: Count,
  /** Of those, files that are test code (see `FileStats.test`). */
  testFiles: Count,
  /**
   * Counted changes (see `Report.logicalChanges`) that touched any file of the
   * territory, test code included.
   */
  changes: Count,
  /**
   * Share of all the heat in this territory, rounded to 4 decimals: the heat
   * of a file is `FileStats.changes × (loc + complexity.total)`. Test code
   * counts for the territory of the code it tests.
   */
  heatShare: UnitInterval,
  /**
   * One line, safe to print (no control characters, one line, at most 160
   * characters): the `description` of the territory's manifest, else the first
   * sentence of its README, else `main files: a, b, c` naming its most changed
   * files. A territory of kind `other` or `tests` says what it is
   * (`12 smaller folders in packages`, `test code`) before its main files.
   */
  description: Schema.String,
  /**
   * Why the territory splits into its children, in plain words (a territory
   * too big, folders that change independently, folders that still change
   * together); null when it does not split.
   */
  splitReason: Schema.NullOr(Schema.String),
  /**
   * How well the territory contains the changes that touch it, where they
   * leak to, and how that moved (see `TerritoryFit`); null for the root,
   * which has no boundary, and for a node that is visible at no detail.
   */
  fit: Schema.NullOr(TerritoryFit),
});
export type Territory = typeof Territory.Type;

/** The territories that are visible at one detail. */
const TerritoryDetail = Schema.Struct({
  /** 1 is the coarsest: the first cut by packages or top-level folders. */
  level: Schema.Int.check(Schema.isGreaterThanOrEqualTo(1)),
  /**
   * `id`s of the territories at this detail; together they hold every file
   * once. Real territories come first, the one with the most heat first, then
   * `tests`, then `other`.
   */
  ids: Schema.Array(Schema.String),
});

/**
 * The territories of the repository: a tree of non-overlapping areas of the
 * code that split further the finer the detail. A territory splits when it is
 * too big or when its folders change independently; folders that change
 * together stay together. The first cut follows the top-level folders, and a package's
 * directory is never skipped over, so a package is a territory of its own as
 * soon as its folder is cut; at most 8 children open at once, the rest wait in
 * an `other` bucket. `modules` is unchanged and independent of it.
 */
export const Territories = Schema.Struct({
  /**
   * The `level` to read first: the finest detail with at most 25 territories
   * (`other` and `tests` nodes do not count) in which no bucket or node of
   * loose files holds a folder that is hotter than the coolest territory opened
   * beside it and holds at least 1% of all heat (below that the comparison is
   * noise); a folder with too few files to be a territory counts like any other
   * when it holds that much, and is a territory of its own then. When every
   * detail with
   * at most 25 territories hides such a folder, the finest of them: its bucket
   * is reported as it is. 0 when the universe has no files.
   */
  recommended: Count,
  /** Level 1 up to 6, coarsest first; fewer for a small repository. Empty without files. */
  details: Schema.Array(TerritoryDetail),
  /** Every node of the tree, parents before their children, the root first. Empty without files. */
  nodes: Schema.Array(Territory),
});
export type Territories = typeof Territories.Type;
