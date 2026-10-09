import { describe, expect, it } from "vitest";

import { buildTerritories } from "./build-territories.js";
import type { TerritoryTree } from "./build-territories.js";
import type { TerritoryFile } from "./node-measures.js";

const file = (path: string, changes = 0): TerritoryFile => ({
  path,
  loc: 10,
  complexity: { total: 5 },
  changes,
});

/** `count` code files directly in `folder`: `<folder>/f1.ts`, `<folder>/f2.ts`, … */
const filesIn = (folder: string, count: number): ReadonlyArray<string> =>
  Array.from({ length: count }, (_, index) => `${folder}/f${index + 1}.ts`);

/** The same change `times` times: one commit-sized change touching `paths`. */
const changed = (
  times: number,
  ...paths: ReadonlyArray<string>
): ReadonlyArray<ReadonlyArray<string>> =>
  Array.from({ length: times }, () => paths);

const build = (
  paths: ReadonlyArray<string>,
  changes: ReadonlyArray<ReadonlyArray<string>>,
  packages: ReadonlyArray<string> = [],
): TerritoryTree =>
  buildTerritories({
    files: paths.map((path) => file(path, 1)),
    changes,
    packages: new Set(packages),
    minChanges: 5,
  });

const idsAt = (tree: TerritoryTree, level: number): ReadonlyArray<string> =>
  tree.details[level - 1]?.ids ?? [];

const nodeOf = (
  tree: TerritoryTree,
  id: string,
): TerritoryTree["nodes"][number] => {
  const node = tree.nodes.find((candidate) => candidate.id === id);
  if (node === undefined) {
    throw new Error(`no node ${id}`);
  }
  return node;
};

/** The paths of the nodes visible at a detail, sorted. */
const pathsAt = (tree: TerritoryTree, level: number): ReadonlyArray<string> =>
  idsAt(tree, level)
    .map((id) => nodeOf(tree, id).path)
    .toSorted();

describe("splitting by size", () => {
  it("splits a territory that holds most of the files, and says its parts still change together", () => {
    const tree = build(
      [
        ...filesIn("big/a", 15),
        ...filesIn("big/b", 15),
        ...filesIn("s1", 5),
        ...filesIn("s2", 5),
      ],
      changed(10, "big/a/f1.ts", "big/b/f1.ts"),
    );

    expect(pathsAt(tree, 1)).toStrictEqual(["big", "s1", "s2"]);
    expect(pathsAt(tree, 2)).toStrictEqual(["big/a", "big/b", "s1", "s2"]);
    const big = tree.nodes.find((node) => node.path === "big");
    expect(big?.splitReason).toBe(
      "30 code files, 75% of all code files; its parts still change together (100% of its changes touch more than one part)",
    );
  });
});

describe("splitting by independence", () => {
  it("splits a territory whose folders change independently, and keeps coupled folders together", () => {
    const tree = build(
      [
        ...filesIn("app/z", 4),
        ...filesIn("app/w", 4),
        ...filesIn("app/x", 4),
        ...filesIn("app/y", 4),
        ...filesIn("lib", 14),
        ...filesIn("tools", 14),
      ],
      [
        ...changed(12, "app/z/f1.ts"),
        ...changed(12, "app/w/f1.ts"),
        ...changed(6, "app/x/f1.ts", "app/y/f1.ts"),
      ],
    );

    expect(pathsAt(tree, 1)).toStrictEqual(["app", "lib", "tools"]);
    expect(pathsAt(tree, 2)).toStrictEqual([
      "app/w",
      "app/z",
      "app/{x,y}",
      "lib",
      "tools",
    ]);
    const app = tree.nodes.find((node) => node.path === "app");
    expect(app?.splitReason).toBe(
      "w and z change independently: 80% of the 30 changes touching it stay inside one part; {x,y} stay together",
    );
    expect(tree.nodes.find((node) => node.path === "app/{x,y}")?.kind).toBe(
      "group",
    );
  });

  it("does not split folders that change independently when there are too few changes to say so", () => {
    const tree = build(
      [
        ...filesIn("app/x", 4),
        ...filesIn("app/y", 4),
        ...filesIn("lib", 14),
        ...filesIn("tools", 14),
      ],
      [...changed(3, "app/x/f1.ts"), ...changed(3, "app/y/f1.ts")],
    );

    expect(tree.details).toHaveLength(1);
    expect(pathsAt(tree, 1)).toStrictEqual(["app", "lib", "tools"]);
  });
});

describe("children and the recommended detail", () => {
  it("opens at most eight children and puts the smaller folders in a bucket that sorts last", () => {
    const folders = Array.from({ length: 10 }, (_, index) => `d${index + 1}`);
    const tree = build(
      folders.flatMap((folder) => filesIn(folder, 4)),
      folders.flatMap((folder, index) => changed(1 + index, `${folder}/f1.ts`)),
    );

    const ids = idsAt(tree, 1);
    const bucket = nodeOf(tree, ids.at(-1) ?? "");
    expect(ids).toHaveLength(8);
    expect(bucket.kind).toBe("other");
    expect(bucket.lead).toBe("3 smaller folders in the repository root");
    expect(bucket.files).toBe(12);
    expect(ids.slice(0, -1).map((id) => nodeOf(tree, id).path)).toStrictEqual([
      "d10",
      "d4",
      "d5",
      "d6",
      "d7",
      "d8",
      "d9",
    ]);
  });

  it("recommends the finest detail with at most 25 territories", () => {
    const tops = Array.from({ length: 8 }, (_, index) => `t${index + 1}`);
    const subs = tops.flatMap((top) =>
      Array.from({ length: 5 }, (_, index) => `${top}/s${index + 1}`),
    );
    const tree = build(
      subs.flatMap((folder) => filesIn(folder, 4)),
      subs.flatMap((folder) => changed(10, `${folder}/f1.ts`)),
    );

    const territories = tree.details.map(
      ({ ids }) =>
        ids.filter((id) => nodeOf(tree, id).kind === "folder").length,
    );
    expect(territories).toStrictEqual([8, 12, 16, 20, 28, 40]);
    expect(tree.recommended).toBe(4);
  });
});

describe("buckets and the recommended detail", () => {
  it("never counts a bucket for the recommended detail", () => {
    const folders = Array.from({ length: 30 }, (_, index) => `d${index + 1}`);
    const tree = build(
      folders.flatMap((folder) => filesIn(folder, 4)),
      folders.flatMap((folder) => changed(10, `${folder}/f1.ts`)),
    );

    const first = idsAt(tree, 1).map((id) => nodeOf(tree, id).kind);
    expect(first).toStrictEqual([
      ...Array.from({ length: 7 }, () => "folder"),
      "other",
    ]);
    expect(tree.details.length).toBeGreaterThan(1);
    const counts = tree.details.map(
      ({ ids }) =>
        ids.filter((id) => nodeOf(tree, id).kind === "folder").length,
    );
    expect(counts[tree.recommended - 1]).toBeLessThanOrEqual(25);
    expect(counts[tree.recommended] ?? 100).toBeGreaterThan(25);
  });
});

describe("packages and small repositories", () => {
  it("marks a package and never cuts a folder off above it", () => {
    const tree = build(
      [
        ...filesIn("services/billing/src", 4),
        ...filesIn("services/auth/lib", 6),
        ...filesIn("web", 6),
      ],
      changed(4, "services/billing/src/f1.ts"),
      ["services/billing"],
    );

    expect(pathsAt(tree, 1)).toStrictEqual(["services", "web"]);
    expect(tree.nodes.map(({ path, kind }) => [path, kind])).toStrictEqual([
      [".", "folder"],
      ["services", "folder"],
      ["services/auth/lib", "folder"],
      ["services/billing", "package"],
      ["web", "folder"],
    ]);
    expect(nodeOf(tree, "t1").splitReason).toBe(
      "the first cut: top-level folders",
    );
  });

  it("is a single territory when the repository is too small to split", () => {
    const tree = build(filesIn("src", 4), changed(3, "src/f1.ts"));

    expect(tree.nodes.map(({ path, kind }) => [path, kind])).toStrictEqual([
      [".", "folder"],
    ]);
    expect(tree.details).toStrictEqual([{ level: 1, ids: ["t1"] }]);
    expect(tree.recommended).toBe(1);
  });

  it("has no territories without files", () => {
    expect(build([], [])).toStrictEqual({
      recommended: 0,
      details: [],
      nodes: [],
      territoryOf: new Map(),
    });
  });
});

describe("hot folders", () => {
  it("opens a small hot folder before bigger cold ones instead of hiding it in the bucket", () => {
    const cold = Array.from({ length: 11 }, (_, index) => `c${index + 1}`);
    const files = [
      ...cold.flatMap((folder) =>
        filesIn(folder, 20).map((path) => file(path, 1)),
      ),
      ...filesIn("hot", 4).map((path) =>
        Object.assign(file(path, 5), { loc: 1000 }),
      ),
    ];
    const tree = buildTerritories({
      files,
      changes: [
        ...changed(5, "hot/f1.ts"),
        ...cold.flatMap((folder) => changed(6, `${folder}/f1.ts`)),
      ],
      packages: new Set(),
      minChanges: 5,
    });

    const recommended = idsAt(tree, tree.recommended).map(
      (id) => nodeOf(tree, id).path,
    );
    expect(idsAt(tree, 1).map((id) => nodeOf(tree, id).path)[0]).toBe("hot");
    expect(recommended).toContain("hot");
    expect(nodeOf(tree, idsAt(tree, 1).at(-1) ?? "").kind).toBe("other");
  });
});

describe("a package that holds every file", () => {
  it("is the root territory", () => {
    const tree = build(
      [...filesIn("app/src/a", 3), ...filesIn("app/src/b", 3)],
      [],
      ["app"],
    );

    expect(tree.nodes.map(({ path, kind }) => [path, kind])).toStrictEqual([
      ["app", "package"],
      ["app/src/a", "folder"],
      ["app/src/b", "folder"],
    ]);
  });
});
