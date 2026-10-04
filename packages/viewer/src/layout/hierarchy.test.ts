import { describe, expect, it } from "vitest";

import { fileStats } from "../testing/reports.js";
import { buildTree } from "./hierarchy.js";
import type { DirectoryNode, TreeNode } from "./hierarchy.js";

const noKeep: ReadonlySet<string> = new Set();

const childNamed = (directory: DirectoryNode, name: string): TreeNode => {
  const child = directory.children.find((node) => node.name === name);
  if (child === undefined) {
    throw new Error(`no child named ${name}`);
  }
  return child;
};

const manySmall = (): ReturnType<typeof fileStats>[] => [
  fileStats("src/big.ts", { loc: 100_000, score: 0.9 }),
  ...Array.from({ length: 8000 }, (_, index) =>
    fileStats(`src/small-${index}.ts`, {
      loc: 1,
      score: index === 7 ? 0.4 : 0.1,
    }),
  ),
];

describe("buildTree", () => {
  it("groups files under their directories", () => {
    const tree = buildTree(
      [
        fileStats("src/a.ts"),
        fileStats("src/b.ts"),
        fileStats("docs/guide.md"),
        fileStats("README.md"),
      ],
      noKeep,
    );

    expect(
      tree.children
        .map((node) => `${node.kind}:${node.name}`)
        .toSorted((a, b) => a.localeCompare(b)),
    ).toEqual(["directory:docs", "directory:src", "file:README.md"]);
    const src = childNamed(tree, "src");
    expect(
      src.kind === "directory" && src.children.map((node) => node.name),
    ).toEqual(["a.ts", "b.ts"]);
  });

  it("merges a directory that only holds another directory into one group", () => {
    const tree = buildTree(
      [
        fileStats("src/main/java/App.java"),
        fileStats("src/main/java/Util.java"),
        fileStats("README.md"),
      ],
      noKeep,
    );

    const merged = childNamed(tree, "src/main/java");
    expect(merged).toMatchObject({ kind: "directory", path: "src/main/java" });
  });

  it("keeps every file as its own tile up to 8,000 files", () => {
    const files = Array.from({ length: 8000 }, (_, index) =>
      fileStats(`src/file-${index}.ts`, { loc: index === 0 ? 1_000_000 : 1 }),
    );

    const tree = buildTree(files, noKeep);

    expect(tree.children.map((node) => node.kind)).toEqual(["directory"]);
    const [src] = tree.children;
    expect(
      src?.kind === "directory" &&
        src.children.every((node) => node.kind === "file"),
    ).toBe(true);
  });
});

describe("buildTree above 8,000 files", () => {
  it("merges files below 0.02% of the total lines into one tile per directory", () => {
    const tree = buildTree(manySmall(), noKeep);

    const src = childNamed(tree, "src");
    expect(src.kind === "directory" && src.children).toEqual([
      expect.objectContaining({ kind: "file", name: "big.ts" }),
      {
        kind: "aggregate",
        name: "8000 small files",
        directory: "src",
        count: 8000,
        paths: Array.from(
          { length: 8000 },
          (_, index) => `src/small-${index}.ts`,
        ),
        loc: 8000,
        score: 0.4,
        change: null,
      },
    ]);
  });

  it("keeps files that must stay selectable as their own tiles", () => {
    const tree = buildTree(manySmall(), new Set(["src/small-3.ts"]));

    const src = childNamed(tree, "src");
    expect(
      src.kind === "directory" && src.children.map((node) => node.name),
    ).toEqual(["big.ts", "small-3.ts", "7999 small files"]);
  });

  it("judges whether to merge small files against the population a part is drawn with", () => {
    const part = manySmall().slice(1, 4);

    const alone = childNamed(buildTree(part, noKeep), "src");
    const among = childNamed(buildTree(part, noKeep, manySmall()), "src");

    expect(
      alone.kind === "directory" && alone.children.map((node) => node.name),
    ).toEqual(["small-0.ts", "small-1.ts", "small-2.ts"]);
    expect(
      among.kind === "directory" && among.children.map((node) => node.name),
    ).toEqual(["3 small files"]);
  });

  it("merges a directory of more small files than a call can take as arguments", () => {
    const files = [
      fileStats("src/big.ts", { loc: 1_000_000_000 }),
      ...Array.from({ length: 130_000 }, (_, index) =>
        fileStats(`gen/file-${index}.ts`, {
          loc: 1,
          score: index === 7 ? 0.9 : 0.1,
        }),
      ),
    ];

    const gen = childNamed(buildTree(files, noKeep), "gen");

    expect(gen.kind === "directory" && gen.children).toMatchObject([
      { kind: "aggregate", count: 130_000, score: 0.9 },
    ]);
  });
});

describe("buildTree aggregates in a comparison", () => {
  it("carries the largest rise and drop among the merged files that were active before", () => {
    // index 5 is new: its change is its whole score, so it must not count
    const trends = new Map([
      [3, { scoreDelta: -0.3, newlyActive: false }],
      [4, { scoreDelta: 0.05, newlyActive: false }],
      [5, { scoreDelta: 0.4, newlyActive: true }],
    ]);
    const files = manySmall().map((file, index) =>
      trends.has(index)
        ? Object.assign({}, file, {
            trend: { previousScore: 0.2, ...trends.get(index) },
          })
        : file,
    );

    const src = childNamed(buildTree(files, noKeep), "src");

    expect(src.kind === "directory" && src.children).toContainEqual(
      expect.objectContaining({
        kind: "aggregate",
        change: { rise: 0.05, drop: -0.3 },
      }),
    );
  });
});
