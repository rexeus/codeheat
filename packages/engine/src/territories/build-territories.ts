// Owns turning the files, the counted changes, and the packages of a
// repository into its territories: a tree of non-overlapping areas of the
// code, the nodes visible at each detail, and the detail to read first.
import { roundReported } from "../report/precision.js";
import type { Territories, Territory } from "../report/territory.js";
import { attachTests } from "./attach-tests.js";
import type { TestAttachment } from "./attach-tests.js";
import { fileLeaves } from "./file-leaves.js";
import { flatten } from "./flatten-tree.js";
import type { FlatNode } from "./flatten-tree.js";
import { growTree } from "./grow-tree.js";
import type { TreeNode } from "./grow-tree.js";
import { NO_MEASURE, measureNodes } from "./node-measures.js";
import type { NodeMeasure, TerritoryFile } from "./node-measures.js";
import type { Evidence } from "./part.js";

/** Territories at the recommended detail number at most this many. */
const RECOMMENDED_MAX_TERRITORIES = 25;
/** A territory's changes say nothing below this many, however low the threshold of ranked modules. */
const MIN_CHANGES = 8;
/** The size bound of a territory: a quarter of the files, within these limits. */
const MIN_SIZE_BOUND = 50;
const MAX_SIZE_BOUND = 150;

export type TerritoryInput = {
  /** The code files of the universe. */
  readonly files: ReadonlyArray<TerritoryFile>;
  /** The counted changes, each as the paths of the files it touched (contract files included). */
  readonly changes: ReadonlyArray<ReadonlyArray<string>>;
  /** The directories that hold a manifest, other than the repository root. */
  readonly packages: ReadonlySet<string>;
  /** `Thresholds.minModuleCommits`. */
  readonly minChanges: number;
};

/** A territory without its description, with what the description is made from. */
export type TerritoryDraft = Omit<Territory, "description"> & {
  /** Every file in the territory, test code included. */
  readonly members: ReadonlyArray<string>;
  /** What an `other` or `tests` node is, to put before its main files; undefined for a real territory. */
  readonly lead: string | undefined;
};

export type TerritoryTree = {
  readonly recommended: Territories["recommended"];
  readonly details: Territories["details"];
  readonly nodes: ReadonlyArray<TerritoryDraft>;
  /** The id of the finest territory of every code file. */
  readonly territoryOf: ReadonlyMap<string, string>;
};

const NOTHING: TerritoryTree = {
  recommended: 0,
  details: [],
  nodes: [],
  territoryOf: new Map(),
};

/** The counted changes as the files that shape the tree: a test follows the code it is paired with, other tests and contract files are left out. */
const evidenceOf = (
  { changes, minChanges }: Pick<TerritoryInput, "changes" | "minChanges">,
  attachment: TestAttachment,
): Evidence => {
  const units = new Set(attachment.units);
  const touched = changes
    .map((paths) => [
      ...new Set(
        paths.flatMap((path) => {
          const unit = units.has(path) ? path : attachment.pairedWith.get(path);
          return unit === undefined ? [] : [unit];
        }),
      ),
    ])
    .filter((files) => files.length > 0);
  const byFile = new Map<string, Array<number>>();
  for (const [index, files] of touched.entries()) {
    for (const file of files) {
      const indices = byFile.get(file) ?? [];
      indices.push(index);
      byFile.set(file, indices);
    }
  }
  const total = attachment.units.length;
  return {
    total,
    changeCount: touched.length,
    byFile,
    changes: touched,
    minChanges: Math.max(MIN_CHANGES, minChanges),
    sizeBound: Math.min(
      MAX_SIZE_BOUND,
      Math.max(MIN_SIZE_BOUND, Math.floor(total / 4)),
    ),
  };
};

const isTerritory = ({ kind }: Pick<Territory, "kind">): boolean =>
  kind === "package" || kind === "folder" || kind === "group";

/** Territories first, then test-only code, then buckets and loose files. */
const roleOf = ({ kind }: Pick<Territory, "kind">): number => {
  if (isTerritory({ kind })) {
    return 0;
  }
  return kind === "tests" ? 1 : 2;
};

const leadOf = ({ node, kind }: FlatNode): string | undefined => {
  const where = node.part.path === "" ? "the repository root" : node.part.path;
  if (kind === "tests") {
    return "test code";
  }
  if (node.part.kind === "more") {
    return `${node.part.members.length} smaller folders in ${where}`;
  }
  return kind === "other" ? `other files in ${where}` : undefined;
};

/** Every file of each node, from the file's leaf up to the root. */
const membersOf = (
  flat: ReadonlyArray<FlatNode>,
  leaves: ReadonlyMap<string, number>,
): ReadonlyArray<ReadonlyArray<string>> => {
  const members: Array<Array<string>> = flat.map(() => []);
  for (const [file, leaf] of leaves) {
    for (
      let at: number | null = leaf;
      at !== null;
      at = flat[at]?.parent ?? null
    ) {
      members[at]?.push(file);
    }
  }
  return members;
};

const draftsOf = (
  flat: ReadonlyArray<FlatNode>,
  measures: ReadonlyArray<NodeMeasure>,
  members: ReadonlyArray<ReadonlyArray<string>>,
): ReadonlyArray<TerritoryDraft> => {
  const idOf = new Map(flat.map(({ node, id }) => [node, id]));
  const totalHeat = measures[0]?.heat ?? 0;
  return flat.map((entry, index) => {
    const measure = measures[index] ?? NO_MEASURE;
    const { node } = entry;
    return {
      id: entry.id,
      path: node.part.path === "" ? "." : node.part.path,
      kind: entry.kind,
      parent: entry.parent === null ? null : (flat[entry.parent]?.id ?? null),
      children: node.children.flatMap((child) => idOf.get(child) ?? []),
      files: measure.files,
      testFiles: measure.testFiles,
      changes: measure.changes,
      heatShare: totalHeat === 0 ? 0 : roundReported(measure.heat / totalHeat),
      splitReason: node.reason ?? null,
      members: members[index] ?? [],
      lead: leadOf(entry),
    };
  });
};

/** The ids at one detail: territories with the most heat first, then test code, then the rest. */
const idsAt = (visible: ReadonlyArray<TerritoryDraft>): ReadonlyArray<string> =>
  visible
    .toSorted(
      (a, b) =>
        roleOf(a) - roleOf(b) ||
        b.heatShare - a.heatShare ||
        b.files - a.files ||
        a.path.localeCompare(b.path),
    )
    .map(({ id }) => id);

/** The detail to read first: the finest with at most 25 territories; the first when even that has more. */
const recommendedOf = (
  visible: ReadonlyArray<ReadonlyArray<TerritoryDraft>>,
): number =>
  Math.max(
    1,
    1 +
      visible
        .map((nodes) => nodes.filter((node) => isTerritory(node)).length)
        .findLastIndex((count) => count <= RECOMMENDED_MAX_TERRITORIES),
  );

/**
 * Builds the territories. The tree is grown over the code files and the test
 * code that belongs to no code; test code that pairs with a source file or sits
 * beside its code (see `attachTests`) belongs to that code's territory, and
 * counts for its files, changes, and heat. The recommended detail is the
 * finest one with at most 25 territories, buckets and test-only territories
 * not counted.
 */
export const buildTerritories = (input: TerritoryInput): TerritoryTree => {
  if (input.files.length === 0) {
    return NOTHING;
  }
  const attachment = attachTests(input.files.map(({ path }) => path));
  const grown = growTree(
    attachment.units,
    evidenceOf(input, attachment),
    input.packages,
  );
  const flat = flatten(grown.root, input.packages);
  const leaves = fileLeaves(flat, attachment);
  const nodes = draftsOf(
    flat,
    measureNodes(
      flat.map(({ parent }) => parent),
      leaves,
      input.files,
      input.changes,
    ),
    membersOf(flat, leaves),
  );
  const draftOf = new Map<TreeNode, TerritoryDraft>(
    flat.flatMap(({ node }, index): Array<[TreeNode, TerritoryDraft]> => {
      const draft = nodes[index];
      return draft === undefined ? [] : [[node, draft]];
    }),
  );
  const visible = grown.details.map((level) =>
    level.flatMap((node) => draftOf.get(node) ?? []),
  );
  return {
    recommended: recommendedOf(visible),
    details: visible.map((drafts, at) => ({
      level: at + 1,
      ids: idsAt(drafts),
    })),
    nodes,
    territoryOf: new Map(
      [...leaves].map(([file, leaf]) => [file, flat[leaf]?.id ?? ""]),
    ),
  };
};
