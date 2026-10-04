import { hierarchy, treemap, treemapSquarify } from "d3-hierarchy";

import type { Size } from "../layout/treemap.js";

/** A tile's rectangle in pixels of the map. */
export type FitRect = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

type Weighted = { readonly id: string; readonly weight: number };

/** The space between two tiles. */
const GAP = 2;

/**
 * Squarified layout of the territories into `size`, area proportional to
 * `weight`. Every tile gets a rectangle; none overlaps another.
 */
export const layoutFitMap = (
  tiles: readonly Weighted[],
  { width, height }: Size,
): Map<string, FitRect> => {
  const placed = new Map<string, FitRect>();
  if (tiles.length === 0 || width <= 0 || height <= 0) {
    return placed;
  }
  const root = hierarchy<Weighted | null>(null, (node) =>
    node === null ? [...tiles] : undefined,
  )
    .sum((node) => node?.weight ?? 0)
    // oxlint-disable-next-line unicorn/no-array-sort -- d3-hierarchy's Node#sort orders the tree in place by design.
    .sort((left, right) => (right.value ?? 0) - (left.value ?? 0));
  const layout = treemap<Weighted | null>()
    .tile(treemapSquarify)
    .size([width, height])
    .paddingInner(GAP)(root);
  for (const { data, x0, y0, x1, y1 } of layout.leaves()) {
    if (data !== null) {
      placed.set(data.id, { x: x0, y: y0, width: x1 - x0, height: y1 - y0 });
    }
  }
  return placed;
};
