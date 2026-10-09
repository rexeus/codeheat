import { describe, expect, it } from "vitest";

import { buildTerritories } from "./build-territories.js";
import { MIN_VISIBLE_HEAT } from "./part.js";
import { recommendedOf } from "./recommend.js";
import type { Shown } from "./recommend.js";

/** A code file whose heat is `heat`: one change over `heat` weighted lines. */
const heated = (path: string, heat: number) => ({
  path,
  loc: heat - 5,
  complexity: { total: 5 },
  changes: 1,
});

/**
 * Two folders of three files at 1650 of heat each, and a folder of two files
 * with `small` heat in all.
 */
const treeWith = (small: readonly [number, number]) =>
  buildTerritories({
    files: [
      ...[1, 2, 3].map((index) => heated(`a/f${index}.ts`, 1650)),
      ...[1, 2, 3].map((index) => heated(`b/f${index}.ts`, 1650)),
      heated("small/f1.ts", small[0]),
      heated("small/f2.ts", small[1]),
    ],
    changes: [],
    packages: new Set(),
    minChanges: 5,
  });

const kindsAt = (tree: ReturnType<typeof treeWith>) =>
  (tree.details[0]?.ids ?? []).map((id) => {
    const node = tree.nodes.find((candidate) => candidate.id === id);
    return [node?.path, node?.kind];
  });

describe("a folder of fewer than three files", () => {
  it("is a territory of its own at 1% of all heat", () => {
    // 100 of 10000
    expect(MIN_VISIBLE_HEAT).toBe(0.01);
    expect(kindsAt(treeWith([50, 50]))).toStrictEqual([
      ["a", "folder"],
      ["b", "folder"],
      ["small", "folder"],
    ]);
  });

  it("stays loose just below 1% of all heat", () => {
    // 99 of 9999
    expect(kindsAt(treeWith([49, 50]))).toStrictEqual([
      ["a", "folder"],
      ["b", "folder"],
      [".", "files"],
    ]);
  });
});

const territory = (share: number): Shown => ({
  kind: "folder",
  parent: "t1",
  share,
  hidden: 0,
});

const bucket = (hidden: number): Shown => ({
  kind: "other",
  parent: "t1",
  share: 0,
  hidden,
});

/** The coarse detail hides nothing; the finer one has a bucket holding a folder of `hidden` beside a territory of 0.005. */
const recommended = (hidden: number) =>
  recommendedOf([
    [territory(0.5), territory(0.5)],
    [territory(0.5), territory(0.005), bucket(hidden)],
  ]);

describe("a bucket that holds a folder cooler than 1% of all heat", () => {
  it("hides nothing just below the floor, however much hotter than the open territory", () => {
    expect(recommended(0.0099)).toBe(2);
  });

  it("hides the folder at the floor when it is hotter than the coolest open territory", () => {
    expect(recommended(0.01)).toBe(1);
  });

  it("hides nothing at the floor when a territory beside it is as hot", () => {
    expect(
      recommendedOf([
        [territory(0.5), territory(0.5)],
        [territory(0.5), territory(0.01), bucket(0.01)],
      ]),
    ).toBe(2);
  });
});
