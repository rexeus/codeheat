import { describe, expect, it } from "vitest";

import type { Module } from "../report/module.js";
import type { ModuleRef } from "./detect.js";
import { leakyEntryPoints, measureInterfaces } from "./interface-churn.js";

const module = (path: string, overrides: Partial<Module>): Module => ({
  path,
  kind: "package",
  files: 3,
  testOnly: false,
  commits: 10,
  localCommits: 5,
  cohesion: 0.5,
  partners: [],
  entryPoints: [`${path}/index.ts`],
  interfaceCommits: 5,
  implementationCommits: 10,
  leakage: 0.5,
  ...overrides,
});

describe("leakyEntryPoints", () => {
  it("maps the entry points of a module at the leakage and commit thresholds to its leakage", () => {
    const modules = [module("a", { leakage: 0.5, implementationCommits: 5 })];

    expect([...leakyEntryPoints(modules)]).toStrictEqual([["a/index.ts", 0.5]]);
  });

  it("skips modules below the leakage threshold, with too few implementation commits, without data, or test-only", () => {
    const modules = [
      module("low", { leakage: 0.4999 }),
      module("few", { leakage: 1, implementationCommits: 4 }),
      module("none", { leakage: null }),
      module("tests", { testOnly: true, leakage: 1 }),
    ];

    expect(leakyEntryPoints(modules).size).toBe(0);
  });
});

describe("measureInterfaces", () => {
  const files = [
    "m/index.ts",
    "m/src/impl.ts",
    "m/src/__tests__/api.ts",
    "m/src/impl.test.ts",
  ];
  const refs = new Map<string, ModuleRef>(
    files.map((file) => [file, { path: "m", kind: "package" }]),
  );
  const measure = (commits: ReadonlyArray<ReadonlyArray<string>>) =>
    measureInterfaces(
      commits.map((commit) =>
        Uint32Array.from(commit, (file) => files.indexOf(file)),
      ),
      files,
      refs,
      new Map([["m", ["m/index.ts"]]]),
    ).get("m");

  it("counts a commit of the entry point and test code only as interface, not implementation", () => {
    const churn = measure([
      ["m/index.ts", "m/src/__tests__/api.ts"],
      ["m/src/__tests__/api.ts", "m/src/impl.test.ts"],
      ["m/src/impl.ts", "m/index.ts"],
      ["m/src/impl.ts"],
    ]);

    // implementation: commits 3 and 4; interface: commits 1 and 3; leaked: commit 3
    expect(churn).toStrictEqual({
      entryPoints: ["m/index.ts"],
      interfaceCommits: 2,
      implementationCommits: 2,
      leakage: 0.5,
    });
  });
});
