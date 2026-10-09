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
 * together, `path` names their directories with one brace glob over the
 * directory they share (`packages/a/{x,y}`). `files`: the loose files of a
 * directory, named `<dir>/*`, those directly in it and in folders too small to be territories,
 * when its folders are territories of their own; judged like any other when it holds at least 1% of all the heat, and otherwise, like a bucket, no real territory.
 * `other`: a bucket of smaller folders that wait for a finer detail; never a
 * real territory. Test code is in no territory.
 */
const TerritoryKind = Schema.Literals([
  "package",
  "folder",
  "group",
  "files",
  "other",
]);

/** One area of the code, a node of the territory tree. */
export const Territory = Schema.Struct({
  /** Identifies the node within this report (`t1`, `t2`, …, in tree order); it carries no meaning across reports. */
  id: Schema.String,
  /**
   * Repository-relative POSIX directory; "." for the whole repository (the root of the tree), or the package that holds every file. A `group` names its
   * directories with a brace glob over the directory they share
   * (`packages/a/{x,y}`, `{apps,lib}` at the root, `packages/{a/src,b}` when
   * one branches deeper; `\`, `,`, `{`, and `}` in a member's name are
   * escaped with a backslash, and the glob is the braces that close the
   * path). A `files` node is the glob of the loose files of its directory
   * (`packages/core/*`, `*` at the root), a bucket (`other`) names the
   * directory its folders are in; its `parent` and `kind` tell it from the
   * territory of that directory. No two nodes of one detail share a path.
   */
  path: Schema.String,
  kind: TerritoryKind,
  /** `id` of the territory this one splits from; null for the root. */
  parent: Schema.NullOr(Schema.String),
  /** `id`s of the territories it splits into, real territories first, then `other`; empty when it does not split. */
  children: Schema.Array(Schema.String),
  /** Code files in the territory (test code is in none). */
  files: Count,
  /** Counted changes (see `Analysis.logicalChanges`) that touched any file of the territory. */
  changes: Count,
  /**
   * Share of all the heat in this territory, rounded to 4 decimals: the heat
   * of a file is `FileStats.changes × (loc + complexity.total)`, over the same
   * counted changes as `changes`.
   */
  heatShare: UnitInterval,
  /**
   * One line, safe to print (no control characters, one line, at most 160
   * characters): the `description` of the territory's manifest, else the first
   * sentence of its README that describes (not an instruction such as "See
   * x.ts for an example.", and none that names a file path), else
   * `main files: a, b, c` naming its most changed files. A territory of kind `other` or `files` says what it
   * is (`12 smaller folders in packages`, `files in packages/core`) before its
   * main files.
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
   * `other`.
   */
  ids: Schema.Array(Schema.String),
});

/**
 * The territories of the repository: a tree of non-overlapping areas of the
 * code that split further the finer the detail. A territory splits when it is
 * too big or when its folders change independently; folders that change
 * together stay together. The first cut follows the top-level folders, and a package's
 * directory is never skipped over, so a package is a territory of its own as
 * soon as its folder is cut; at most 8 folders, groups, and a bucket open at
 * once, the rest wait in an `other` bucket, and the loose files of the
 * directory are a `files` territory beside them. `modules` is unchanged and
 * independent of it.
 */
export const Territories = Schema.Struct({
  /**
   * The `level` to read first: the finest detail with at most 25 territories
   * (`other` nodes do not count) in which no bucket or node of
   * loose files holds a folder that is hotter than the coolest folder opened
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
