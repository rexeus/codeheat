import { hierarchy, treemap, treemapSquarify } from "d3-hierarchy";

import type { DirectoryNode, LeafNode, TreeNode } from "./hierarchy.js";

type Rect = {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
};

export type PlacedLeaf = { readonly node: LeafNode; readonly rect: Rect };

export type PlacedGroup = {
  readonly name: string;
  readonly depth: number;
  readonly rect: Rect;
  /** Whether the group reserves a header strip for its name. */
  readonly labelled: boolean;
};

/** Leaves and groups in paint order: parents before their children. */
export type TreemapLayout = {
  readonly leaves: readonly PlacedLeaf[];
  readonly groups: readonly PlacedGroup[];
};

export type Size = { readonly width: number; readonly height: number };

/** Height of the strip a labelled group reserves for its name. */
export const GROUP_HEADER_HEIGHT = 16;
const TILE_GAP = 1;
const GROUP_PADDING = 2;
/** Groups smaller than this area (px²) skip the header: no name would fit. */
const MIN_LABELLED_GROUP_AREA = 4000;

/** Tile area is lines of code; an empty file still gets a sliver to click. */
const leafValue = (node: TreeNode): number => {
  if (node.kind === "directory") {
    return 0;
  }
  return Math.max(node.kind === "file" ? node.file.loc : node.loc, 1);
};

/**
 * Squarified layout of `root` into `size`. Tile area is proportional to lines
 * of code; groups keep their children inside their own rectangle.
 */
export const layoutTreemap = (
  root: DirectoryNode,
  { width, height }: Size,
): TreemapLayout => {
  const tree = hierarchy<TreeNode>(root, (node) =>
    node.kind === "directory" ? [...node.children] : undefined,
  )
    .sum(leafValue)
    // oxlint-disable-next-line unicorn/no-array-sort -- d3-hierarchy's Node#sort orders the tree in place by design.
    .sort((left, right) => (right.value ?? 0) - (left.value ?? 0));
  const total = tree.value ?? 0;
  if (total === 0 || width <= 0 || height <= 0) {
    return { leaves: [], groups: [] };
  }
  const isLabelled = (value: number | undefined): boolean =>
    ((value ?? 0) / total) * width * height >= MIN_LABELLED_GROUP_AREA;

  const placed = treemap<TreeNode>()
    .tile(treemapSquarify)
    .size([width, height])
    .paddingInner(TILE_GAP)
    .paddingOuter(GROUP_PADDING)
    .paddingTop((node) =>
      node.depth > 0 && isLabelled(node.value)
        ? GROUP_HEADER_HEIGHT
        : GROUP_PADDING,
    )(tree);

  const leaves = placed
    .leaves()
    .flatMap(({ data, x0, y0, x1, y1 }) =>
      data.kind === "directory"
        ? []
        : [{ node: data, rect: { x0, y0, x1, y1 } }],
    );
  const groups = placed
    .descendants()
    .filter((node) => node.depth > 0 && node.data.kind === "directory")
    .map(({ data, depth, value, x0, y0, x1, y1 }) => ({
      name: data.name,
      depth,
      rect: { x0, y0, x1, y1 },
      labelled: isLabelled(value),
    }));
  return { leaves, groups };
};
