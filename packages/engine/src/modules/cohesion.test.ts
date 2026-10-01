import { describe, expect, it } from "vitest";

import type { Module } from "../report/module.js";
import { measureModules, minModuleCommitsFor } from "./cohesion.js";
import type { ModuleRef } from "./detect.js";

/** Measures `commits` (lists of file paths) over files assigned to modules by `moduleOf`. */
const measure = (
  moduleOf: Readonly<Record<string, string>>,
  commits: ReadonlyArray<ReadonlyArray<string>>,
  minModuleCommits: number,
): ReadonlyArray<Module> => {
  const paths = Object.keys(moduleOf);
  const refs = new Map<string, ModuleRef>(
    Object.entries(moduleOf).map(([file, path]) => [
      file,
      { path, kind: "directory" },
    ]),
  );
  return measureModules(
    commits.map((files) => Uint32Array.from(files, (f) => paths.indexOf(f))),
    paths,
    refs,
    minModuleCommits,
  );
};

describe("minModuleCommitsFor", () => {
  it("keeps a floor of 5 and grows with one percent of the counted commits", () => {
    expect(
      [0, 500, 501, 1000, 2345].map((count) => minModuleCommitsFor(count)),
    ).toStrictEqual([5, 5, 6, 10, 24]);
  });
});

describe("measureModules order", () => {
  it("ranks first, then the other measured modules, then those without commits", () => {
    const moduleOf = {
      "a/a.ts": "a",
      "b/b.ts": "b",
      "c/c.ts": "c",
      "t/t.test.ts": "t",
      "q/q.ts": "q",
    };
    const commits = [
      ["a/a.ts", "b/b.ts"],
      ["a/a.ts", "b/b.ts"],
      ["a/a.ts"],
      ["c/c.ts"],
      ["c/c.ts"],
      ["t/t.test.ts"],
      ["t/t.test.ts"],
    ];

    const modules = measure(moduleOf, commits, 3);

    // a is the only ranked module although b is less cohesive; c and t tie on cohesion and commits
    expect(modules.map(({ path, cohesion }) => [path, cohesion])).toStrictEqual(
      [
        ["a", 0.3333],
        ["b", 0],
        ["c", 1],
        ["t", 1],
        ["q", null],
      ],
    );
  });
});

describe("measureModules testOnly", () => {
  it("flags modules made of test files or living in a test directory", () => {
    const moduleOf = {
      "units/a.test.ts": "units",
      "mixed/b.ts": "mixed",
      "mixed/b.test.ts": "mixed",
      "packages/app/e2e/flow.ts": "packages/app/e2e",
      "src/__tests__/x.ts": "src/__tests__",
      "src/contest/y.ts": "src/contest",
    };

    const modules = measure(moduleOf, [], 5);

    expect(
      Object.fromEntries(modules.map(({ path, testOnly }) => [path, testOnly])),
    ).toStrictEqual({
      units: true,
      mixed: false,
      "packages/app/e2e": true,
      "src/__tests__": true,
      "src/contest": false,
    });
  });
});

describe("measureModules partners", () => {
  it("keeps the five strongest partners, ties by path", () => {
    const moduleOf = {
      "hub/h.ts": "hub",
      "p1/x.ts": "p1",
      "p2/x.ts": "p2",
      "p3/x.ts": "p3",
      "p4/x.ts": "p4",
      "p5/x.ts": "p5",
      "p6/x.ts": "p6",
      "p7/x.ts": "p7",
    };
    const commits = [
      ["hub/h.ts", "p7/x.ts"],
      ["hub/h.ts", "p7/x.ts"],
      ["hub/h.ts", "p6/x.ts"],
      ["hub/h.ts", "p5/x.ts"],
      ["hub/h.ts", "p4/x.ts"],
      ["hub/h.ts", "p3/x.ts"],
      ["hub/h.ts", "p2/x.ts"],
      ["hub/h.ts", "p1/x.ts"],
    ];

    const hub = measure(moduleOf, commits, 5).find(
      ({ path }) => path === "hub",
    );

    expect(hub?.partners).toStrictEqual([
      { path: "p7", sharedCommits: 2 },
      { path: "p1", sharedCommits: 1 },
      { path: "p2", sharedCommits: 1 },
      { path: "p3", sharedCommits: 1 },
      { path: "p4", sharedCommits: 1 },
    ]);
  });
});
