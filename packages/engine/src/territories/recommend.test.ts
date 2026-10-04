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
});

const part = (overrides: Partial<Part>): Part => ({
  kind: "folder",
  path: "",
  cut: "",
  files: [],
  members: [],
  base: "",
  rest: [],
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
  // 100 of test code placed in `lib/small`, 500 more placed in `lib` itself: each directory counts what is placed at or below it.
  placed: new Map([
    ["lib/small", 100],
    ["lib", 600],
    ["", 600],
  ]),
  totalHeat: 1000,
};

describe("shownOf", () => {
  const files = ["lib/a.ts", "lib/small/x.ts", "lib/small/y.ts"];
  const shown = shownOf(
    [
      node("t1", "folder", null, part({ path: "", files })),
      node(
        "t2",
        "other",
        0,
        part({ kind: "other", path: "lib", base: "lib", files }),
      ),
    ],
    evidence,
  );

  it("reads the hottest folder a node of loose files holds, one with too few files to be a territory included", () => {
    expect(shown.get("t2")?.hidden).toBeCloseTo(0.3, 10);
  });

  it("counts test code placed at or below a folder for it, and test code placed above it for none of its folders", () => {
    expect(shown.get("t1")).toStrictEqual({
      kind: "folder",
      parent: null,
      share: 0.801,
      hidden: 0,
    });
    expect(shown.get("t2")?.share).toBeCloseTo(0.201, 10);
  });
});

describe("shownOf for a folder cut from a directory above its path", () => {
  it("counts test code placed between the directory it was cut from and the one its path was cut down to", () => {
    const tested: Evidence = {
      ...evidence,
      heat: new Map([["big/server/src/app/x/f.ts", 10]]),
      // 500 of test code placed in `big/server/src`, between `big` and `big/server/src/app`
      placed: new Map([
        ["big/server/src", 500],
        ["big/server", 500],
        ["big", 500],
        ["", 500],
      ]),
    };

    const shown = shownOf(
      [
        node(
          "t1",
          "folder",
          null,
          part({
            path: "big/server/src/app",
            cut: "big",
            files: ["big/server/src/app/x/f.ts"],
          }),
        ),
      ],
      tested,
    );

    expect(shown.get("t1")?.share).toBeCloseTo(0.51, 10);
  });
});
