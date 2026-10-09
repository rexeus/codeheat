import { describe, expect, it } from "vitest";

import type { FlatNode } from "./flatten-tree.js";
import type { Evidence, Part } from "./part.js";
import { recommendedOf, shownOf } from "./recommend.js";
import type { Shown } from "./recommend.js";

const territory = (share: number): Shown => ({
  kind: "folder",
  parent: "t1",
  share,
  hidden: 0,
});

/** A bucket that holds a folder with the given share of the heat. */
const bucket = (hidden: number): Shown => ({
  kind: "other",
  parent: "t1",
  share: 0,
  hidden,
});

/** `count` territories at 0.1 of the heat each, and a bucket holding a folder of `hidden` unless it is left out. */
const detail = (count: number, hidden?: number): ReadonlyArray<Shown> => [
  ...Array.from({ length: count }, () => territory(0.1)),
  ...(hidden === undefined ? [] : [bucket(hidden)]),
];

describe("recommendedOf", () => {
  it("takes the finest detail with at most 25 territories", () => {
    expect(recommendedOf([detail(5), detail(25), detail(26)])).toBe(2);
  });

  it("refuses a detail whose bucket hides a folder hotter than a territory opened beside it", () => {
    expect(
      recommendedOf([detail(5, 0.05), detail(10, 0.2), detail(20, 0.05)]),
    ).toBe(3);
    expect(
      recommendedOf([detail(5, 0.05), detail(10, 0.05), detail(20, 0.2)]),
    ).toBe(2);
  });

  it("keeps the finest detail with at most 25 territories when every one of them hides a folder", () => {
    expect(
      recommendedOf([detail(5, 0.2), detail(25, 0.2), detail(30, 0.05)]),
    ).toBe(2);
  });

  it("takes the first detail when even the coarsest has more than 25 territories", () => {
    expect(recommendedOf([detail(30), detail(40)])).toBe(1);
  });

  it("ignores a bucket that has no territory beside it", () => {
    expect(recommendedOf([[bucket(0.5)], detail(3, 0.05)])).toBe(2);
  });

  it("compares a hidden folder with the folders opened beside it, not with loose files", () => {
    const looseFiles: Shown = { ...territory(0.001), kind: "files" };

    expect(recommendedOf([detail(5), [...detail(10, 0.05), looseFiles]])).toBe(
      2,
    );
  });
});

const part = (overrides: Partial<Part>): Part => ({
  kind: "folder",
  path: "",
  files: [],
  members: [],
  base: "",
  ...overrides,
});

const node = (
  id: string,
  kind: FlatNode["kind"],
  parent: number | null,
  p: Part,
): FlatNode => ({
  id,
  kind,
  parent,
  node: { part: p, reason: undefined, children: [] },
});

const evidence: Evidence = {
  total: 4,
  changeCount: 0,
  byFile: new Map(),
  changes: [],
  minChanges: 8,
  sizeBound: 50,
  heat: new Map([
    ["lib/a.ts", 1],
    ["lib/small/x.ts", 100],
    ["lib/small/y.ts", 100],
  ]),
  totalHeat: 1000,
};

describe("shownOf", () => {
  const files = ["lib/a.ts", "lib/small/x.ts", "lib/small/y.ts"];
  const shown = shownOf(
    [
      node("t1", "folder", null, part({ path: "", cut: "", files })),
      node(
        "t2",
        "files",
        0,
        part({ kind: "files", path: "lib", base: "lib", files }),
      ),
    ],
    evidence,
  );

  it("reads the hottest folder a node of loose files holds, one with too few files to be a territory included", () => {
    expect(shown.get("t2")?.hidden).toBeCloseTo(0.2, 10);
  });

  it("reads the share of all heat a node holds", () => {
    expect(shown.get("t1")).toStrictEqual({
      kind: "folder",
      parent: null,
      share: 0.201,
      hidden: 0,
    });
    expect(shown.get("t2")?.share).toBeCloseTo(0.201, 10);
  });
});
