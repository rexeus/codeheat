import { describe, expect, it } from "vitest";

import { fileStats } from "../testing/reports.js";
import { buildTree } from "./hierarchy.js";
import { layoutTreemap } from "./treemap.js";
import type { PlacedLeaf } from "./treemap.js";

const size = { width: 1000, height: 600 };
const area = ({ x0, y0, x1, y1 }: PlacedLeaf["rect"]): number =>
  (x1 - x0) * (y1 - y0);
const layoutOf = (paths: Record<string, number>) =>
  layoutTreemap(
    buildTree(
      Object.entries(paths).map(([path, loc]) => fileStats(path, { loc })),
      new Set(),
    ),
    size,
  );
const leafPaths = (leaves: readonly PlacedLeaf[]): string[] =>
  leaves.flatMap(({ node }) => (node.kind === "file" ? [node.path] : []));

describe("layoutTreemap", () => {
  it("places one tile per file, inside the requested size", () => {
    const { leaves } = layoutOf({
      "a/x.ts": 300,
      "a/y.ts": 100,
      "b/z.ts": 200,
      "w.ts": 50,
    });

    expect(leafPaths(leaves).toSorted((a, b) => a.localeCompare(b))).toEqual([
      "a/x.ts",
      "a/y.ts",
      "b/z.ts",
      "w.ts",
    ]);
    for (const { rect } of leaves) {
      expect(rect.x0).toBeGreaterThanOrEqual(0);
      expect(rect.y0).toBeGreaterThanOrEqual(0);
      expect(rect.x1).toBeLessThanOrEqual(size.width);
      expect(rect.y1).toBeLessThanOrEqual(size.height);
    }
  });
});

describe("layoutTreemap tile sizes", () => {
  it("sizes sibling tiles by their lines of code", () => {
    const { leaves } = layoutOf({ "x.ts": 300, "y.ts": 100 });

    const [big, small] = leaves;
    expect(
      area(big?.rect ?? { x0: 0, y0: 0, x1: 0, y1: 0 }) /
        area(small?.rect ?? { x0: 0, y0: 0, x1: 1, y1: 1 }),
    ).toBeCloseTo(3, 1);
  });

  it("nests tiles inside the group of their directory", () => {
    const { groups, leaves } = layoutOf({
      "a/x.ts": 300,
      "a/y.ts": 100,
      "b/z.ts": 200,
    });

    const groupA = groups.find(({ name }) => name === "a");
    const inA = leaves.filter(
      ({ node }) => node.kind === "file" && node.path.startsWith("a/"),
    );
    expect(groupA).toBeDefined();
    for (const { rect } of inA) {
      expect(rect.x0).toBeGreaterThanOrEqual(groupA?.rect.x0 ?? Infinity);
      expect(rect.y0).toBeGreaterThanOrEqual(groupA?.rect.y0 ?? Infinity);
      expect(rect.x1).toBeLessThanOrEqual(groupA?.rect.x1 ?? -Infinity);
      expect(rect.y1).toBeLessThanOrEqual(groupA?.rect.y1 ?? -Infinity);
    }
  });

  it("reserves a name strip only for groups big enough to show one", () => {
    const { groups } = layoutOf({ "big/a.ts": 100_000, "tiny/b.ts": 1 });

    expect(
      groups.map(({ name, labelled }) => `${name}:${String(labelled)}`),
    ).toEqual(expect.arrayContaining(["big:true", "tiny:false"]));
  });

  it("gives a file without lines a tile too", () => {
    const { leaves } = layoutOf({ "empty.ts": 0, "full.ts": 100 });

    expect(leaves).toHaveLength(2);
  });

  it("places nothing without files or without room", () => {
    const empty = layoutTreemap(buildTree([], new Set()), size);
    const cramped = layoutTreemap(buildTree([fileStats("a.ts")], new Set()), {
      width: 0,
      height: 400,
    });

    expect(empty).toEqual({ leaves: [], groups: [] });
    expect(cramped).toEqual({ leaves: [], groups: [] });
  });
});
