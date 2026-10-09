// Owns turning the files, the counted changes, and the packages of a
// repository into its territories: a tree of non-overlapping areas of the
// code, the nodes visible at each detail, and the detail to read first.
import { roundReported } from "../model/precision.js";
import type { Territories, Territory } from "../model/territory.js";
import { evidenceOf } from "./evidence.js";
import type { EvidenceInput } from "./evidence.js";
import { fileLeaves } from "./file-leaves.js";
import { flatten } from "./flatten-tree.js";
import type { FlatNode } from "./flatten-tree.js";
import { growTree } from "./grow-tree.js";
import { NO_MEASURE, measureNodes } from "./node-measures.js";
import type { NodeMeasure } from "./node-measures.js";
import type { TreeNode } from "./part.js";
import { isTerritoryKind, recommendedOf, shownOf } from "./recommend.js";

export type TerritoryInput = EvidenceInput & {
  /** The directories that hold a manifest, other than the repository root. */
  readonly packages: ReadonlySet<string>;
};

/** A territory without its description, with what the description is made from. */
export type TerritoryDraft = Omit<Territory, "description"> & {
  /** Every file in the territory. */
  readonly members: ReadonlyArray<string>;
  /** What an `other` or `files` node is, to put before its main files; undefined for any other territory. */
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

/** Territories (loose files included) first, then buckets. */
const roleOf = ({ kind }: Pick<Territory, "kind">): number =>
  isTerritoryKind(kind) ? 0 : 1;

const leadOf = ({ node, kind }: FlatNode): string | undefined => {
  const where = node.part.path === "" ? "the repository root" : node.part.path;
  if (node.part.kind === "more") {
    return `${node.part.members.length} smaller folders in ${where}`;
  }
  return kind === "files" ? `files in ${where}` : undefined;
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
      changes: measure.changes,
      heatShare: totalHeat === 0 ? 0 : roundReported(measure.heat / totalHeat),
      splitReason: node.reason ?? null,
      fit: null,
      members: members[index] ?? [],
      lead: leadOf(entry),
    };
  });
};

/** The ids at one detail: territories with the most heat first, then the rest. */
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

/**
 * Builds the territories, grown over the code files (test code is none of
 * them). The recommended detail is the finest one with at most 25
 * territories, buckets not counted.
 */
export const buildTerritories = (input: TerritoryInput): TerritoryTree => {
  if (input.files.length === 0) {
    return NOTHING;
  }
  const evidence = evidenceOf(input);
  const grown = growTree(
    input.files.map(({ path }) => path).toSorted(),
    evidence,
    input.packages,
  );
  const flat = flatten(grown.root, input.packages);
  const leaves = fileLeaves(flat);
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
  const shown = shownOf(flat, evidence);
  const visible = grown.details.map((level) =>
    level.flatMap((node) => draftOf.get(node) ?? []),
  );
  return {
    recommended: recommendedOf(
      visible.map((drafts) => drafts.flatMap(({ id }) => shown.get(id) ?? [])),
    ),
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
