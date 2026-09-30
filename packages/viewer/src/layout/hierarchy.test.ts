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
        loc: 8000,
        score: 0.4,
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
});
