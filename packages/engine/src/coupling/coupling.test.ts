import { describe, expect, it } from "vitest";

import type { ModuleRef } from "../modules/detect.js";
import { findCouplings as findCouplingsByFileId } from "./coupling.js";

/** Numbers the paths in order of first appearance; any numbering works, since findCouplings orders each pair by path. */
const findCouplings = (
  commits: ReadonlyArray<ReadonlyArray<string>>,
  changes: ReadonlyMap<string, number>,
  modules: ReadonlyMap<string, ModuleRef> = new Map(),
  contracts: ReadonlySet<string> = new Set(),
) => {
  const paths = [...new Set(commits.flat())];
  const indexed = commits.map((commit) => ({
    files: Uint32Array.from(commit, (path) => paths.indexOf(path)),
    size: commit.length,
    weight: 1,
  }));
  const counts = new Map(
    [...changes].map(([path, count]) => [
      path,
      { changes: count, weightedChanges: count },
    ]),
  );
  return findCouplingsByFileId(indexed, paths, counts, {
    modules,
    contracts,
  });
};

const pkg = (path: string): ModuleRef => ({ path, kind: "package" });

const repeat = <T>(count: number, value: T): Array<T> =>
  Array.from({ length: count }, () => value);

describe("findCouplings", () => {
  it("reports the shared commits, degree, and distance of a coupled pair", () => {
    // a.ts changed in 8 commits, b.ts in 4 (all with a.ts), c.ts in 3 (all with a.ts)
    const commits = [
      ...repeat(4, ["src/a.ts", "src/b.ts"]),
      ...repeat(3, ["src/a.ts", "lib/deep/c.ts"]),
      ["src/a.ts"],
    ];
    const changes = new Map([
      ["src/a.ts", 8],
      ["src/b.ts", 4],
      ["lib/deep/c.ts", 3],
    ]);

    const { couplings } = findCouplings(commits, changes);

    expect(couplings).toHaveLength(2);
    expect(couplings[0]).toMatchObject({
      a: "src/a.ts",
      b: "src/b.ts",
      sharedCommits: 4,
      distance: 0,
      testPair: false,
    });
    // 4 shared commits / mean(8, 4) changes = 0.66667
    expect(couplings[0]?.degree).toBe(0.6667);
    expect(couplings[1]).toMatchObject({
      a: "lib/deep/c.ts",
      b: "src/a.ts",
      sharedCommits: 3,
      distance: 3,
    });
    // 3 shared commits / mean(3, 8) changes = 0.54545
    expect(couplings[1]?.degree).toBe(0.5455);
  });
});

describe("findCouplings thresholds", () => {
  it("drops pairs with fewer than three shared commits", () => {
    const commits = repeat(2, ["a.ts", "b.ts"]);
    const changes = new Map([
      ["a.ts", 2],
      ["b.ts", 2],
    ]);

    expect(findCouplings(commits, changes).couplings).toStrictEqual([]);
  });

  it("drops pairs whose degree is below 0.3", () => {
    // 3 shared commits / mean(20, 20) changes = 0.15
    const commits = repeat(3, ["a.ts", "b.ts"]);
    const changes = new Map([
      ["a.ts", 20],
      ["b.ts", 20],
    ]);

    expect(findCouplings(commits, changes).couplings).toStrictEqual([]);
  });

  it("keeps a pair at exactly the minimum shared commits and degree", () => {
    // 3 shared commits / mean(10, 10) changes = 0.3
    const commits = repeat(3, ["a.ts", "b.ts"]);
    const changes = new Map([
      ["a.ts", 10],
      ["b.ts", 10],
    ]);

    expect(findCouplings(commits, changes).couplings).toHaveLength(1);
  });
});

describe("findCouplings commit size", () => {
  it("ignores commits touching more than 50 files", () => {
    const files = Array.from({ length: 51 }, (_, index) => `f${index}.ts`);
    const changes = new Map(files.map((file) => [file, 3]));

    const result = findCouplings(repeat(3, files), changes);

    expect(result).toMatchObject({ couplingCommits: 0, couplings: [] });
    expect(new Set(result.breadth.values())).toStrictEqual(new Set([0]));
  });

  it("counts commits touching exactly 50 files", () => {
    const files = Array.from({ length: 50 }, (_, index) => `f${index}.ts`);
    const changes = new Map(files.map((file) => [file, 3]));

    const result = findCouplings(repeat(3, files), changes);

    // 50 * 49 / 2 pairs, each shared by all 3 commits
    expect(result.couplingCommits).toBe(3);
    expect(result.couplings).toHaveLength(1225);
  });

  it("sizes a commit by every file it touched, not by the ids left to count", () => {
    const touched = { files: Uint32Array.of(0, 1), size: 51, weight: 1 };

    const result = findCouplingsByFileId(
      repeat(3, touched),
      ["a.ts", "b.ts"],
      new Map(),
      { modules: new Map(), contracts: new Set() },
    );

    expect(result).toMatchObject({ couplingCommits: 0, couplings: [] });
  });
});

describe("findCouplings pair facts", () => {
  it("marks a file and its test as a test pair", () => {
    const commits = repeat(3, ["src/a.ts", "src/a.test.ts", "src/b.ts"]);
    const changes = new Map([
      ["src/a.ts", 3],
      ["src/a.test.ts", 3],
      ["src/b.ts", 3],
    ]);

    const { couplings } = findCouplings(commits, changes);

    expect(
      couplings.map(({ a, b, testPair }) => [a, b, testPair]),
    ).toStrictEqual([
      ["src/a.test.ts", "src/a.ts", true],
      ["src/a.test.ts", "src/b.ts", false],
      ["src/a.ts", "src/b.ts", false],
    ]);
  });

  it("sorts pairs by degree and then by shared commits", () => {
    const commits = [
      ...repeat(3, ["a.ts", "b.ts"]),
      ...repeat(4, ["c.ts", "d.ts"]),
      ...repeat(4, ["e.ts", "f.ts"]),
    ];
    const changes = new Map([
      ["a.ts", 3],
      ["b.ts", 3],
      ["c.ts", 4],
      ["d.ts", 4],
      ["e.ts", 8],
      ["f.ts", 8],
    ]);

    const { couplings } = findCouplings(commits, changes);

    // degrees: a-b 3/3 = 1, c-d 4/4 = 1, e-f 4/8 = 0.5; c-d shares more commits than a-b
    expect(couplings.map(({ a, b }) => `${a} ${b}`)).toStrictEqual([
      "c.ts d.ts",
      "a.ts b.ts",
      "e.ts f.ts",
    ]);
  });
});

describe("findCouplings breadth", () => {
  it("counts the distinct files a file changed with, however rarely", () => {
    // index.ts joins each of f0..f11 in one commit: 12 partners, no coupling
    const files = Array.from({ length: 12 }, (_, index) => `f${index}.ts`);
    const commits = files.map((file) => ["index.ts", file]);

    const { breadth, couplings } = findCouplings(commits, new Map());

    expect(couplings).toStrictEqual([]);
    expect(breadth.get("index.ts")).toBe(12);
    expect(breadth.get("f0.ts")).toBe(1);
  });

  it("counts a repeated partner once", () => {
    const commits = [
      ["a.ts", "b.ts"],
      ["a.ts", "b.ts"],
      ["a.ts", "b.ts", "c.ts"],
    ];

    const { breadth } = findCouplings(commits, new Map());

    expect([...breadth]).toStrictEqual([
      ["a.ts", 2],
      ["b.ts", 2],
      ["c.ts", 2],
    ]);
  });

  it("gives a file that only changed alone a breadth of zero", () => {
    const { breadth } = findCouplings([["a.ts"], ["b.ts", "c.ts"]], new Map());

    expect(breadth.get("a.ts")).toBe(0);
  });
});

describe("findCouplings modules", () => {
  it("marks a pair of files in different modules as crossing", () => {
    const commits = repeat(3, ["app/a.ts", "lib/b.ts", "lib/c.ts"]);
    const modules = new Map([
      ["app/a.ts", pkg("app")],
      ["lib/b.ts", pkg("lib")],
      ["lib/c.ts", pkg("lib")],
    ]);

    const { couplings } = findCouplings(commits, new Map(), modules);

    expect(
      couplings.map(({ a, b, crossesModule }) => [a, b, crossesModule]),
    ).toStrictEqual([
      ["app/a.ts", "lib/b.ts", true],
      ["app/a.ts", "lib/c.ts", true],
      ["lib/b.ts", "lib/c.ts", false],
    ]);
  });
});

describe("findCouplings contract files", () => {
  it("tells contract files from code on both sides of a pair", () => {
    const commits = repeat(3, [
      "api/main.tsp",
      "src/api.ts",
      "api/types.proto",
    ]);
    const changes = new Map([
      ["api/main.tsp", 3],
      ["src/api.ts", 3],
      ["api/types.proto", 3],
    ]);

    const { couplings } = findCouplings(
      commits,
      changes,
      new Map(),
      new Set(["api/main.tsp", "api/types.proto"]),
    );

    expect(
      couplings.map(({ a, b, kinds }) => [a, b, kinds.a, kinds.b]),
    ).toStrictEqual([
      ["api/main.tsp", "src/api.ts", "contract", "code"],
      ["api/types.proto", "src/api.ts", "contract", "code"],
      ["api/main.tsp", "api/types.proto", "contract", "contract"],
    ]);
  });

  it("lists pairs with a code side before pairs of two contracts, however strong", () => {
    const siblings = Array.from(
      { length: 6 },
      (_, index) => `api/m${index}.tsp`,
    );
    const commits = [
      ...repeat(5, siblings),
      ...repeat(3, ["packages/a/x.ts", "packages/b/y.ts"]),
      ...repeat(3, ["packages/a/p.ts", "packages/b/q.ts"]),
    ];
    const changes = new Map<string, number>([
      ...siblings.map((path): [string, number] => [path, 5]),
      ["packages/a/x.ts", 10],
      ["packages/b/y.ts", 10],
      ["packages/a/p.ts", 6],
      ["packages/b/q.ts", 6],
    ]);

    const { couplings } = findCouplings(
      commits,
      changes,
      new Map(),
      new Set(siblings),
    );

    // the 15 sibling pairs have degree 1; the code pairs have 0.3 and 0.5
    expect(couplings).toHaveLength(17);
    expect(
      couplings.slice(0, 3).map(({ a, b, degree }) => [a, b, degree]),
    ).toStrictEqual([
      ["packages/a/p.ts", "packages/b/q.ts", 0.5],
      ["packages/a/x.ts", "packages/b/y.ts", 0.3],
      ["api/m0.tsp", "api/m1.tsp", 1],
    ]);
  });
});
