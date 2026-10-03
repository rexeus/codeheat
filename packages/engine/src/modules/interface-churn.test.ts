import { describe, expect, it } from "vitest";

import type { Module } from "../report/module.js";
import type { ModuleRef } from "./detect.js";
import {
  isLeakyInterface,
  leakingEntryPoints,
  measureInterfaces,
} from "./interface-churn.js";

const files = [
  "m/index.ts",
  "m/src/index.ts",
  "m/src/impl.ts",
  "m/src/__tests__/api.ts",
  "m/src/impl.test.ts",
];
const refs = new Map<string, ModuleRef>(
  files.map((file) => [file, { path: "m", kind: "package" }]),
);
const touching = (commit: ReadonlyArray<string>) => ({
  files: Uint32Array.from(commit, (file) => files.indexOf(file)),
  size: commit.length,
  subjectKind: "other" as const,
});
const measure = (commits: ReadonlyArray<ReadonlyArray<string>>) =>
  measureInterfaces(
    { changes: commits.map((commit) => touching(commit)), paths: files },
    refs,
    new Map([["m", ["m/index.ts", "m/src/index.ts"]]]),
  );

describe("measureInterfaces", () => {
  it("counts a commit of an entry point and test code only as interface, not implementation", () => {
    const { byModule } = measure([
      ["m/src/index.ts", "m/src/__tests__/api.ts"],
      ["m/src/__tests__/api.ts", "m/src/impl.test.ts"],
      ["m/src/impl.ts", "m/src/index.ts"],
      ["m/src/impl.ts"],
    ]);

    // implementation: commits 3 and 4; interface: commits 1 and 3; leaked: commit 3
    expect(byModule.get("m")).toStrictEqual({
      entryPoints: ["m/index.ts", "m/src/index.ts"],
      interfaceCommits: 2,
      implementationCommits: 2,
      leakage: 0.5,
    });
  });

  it("names only the entry points that changed in a commit that also changed the implementation", () => {
    const { leakedEntryPoints } = measure([
      ["m/src/index.ts"],
      ["m/src/impl.ts", "m/src/index.ts"],
      ["m/src/impl.ts"],
    ]);

    // m/index.ts never changed; src/index.ts did, with impl.ts in the second commit
    expect([...leakedEntryPoints]).toStrictEqual(["m/src/index.ts"]);
  });

  it("ignores commits above the counted size", () => {
    const huge = {
      files: Uint32Array.of(0, 1, 2, 3, 4),
      size: 51,
      subjectKind: "other" as const,
    };
    const small = touching(["m/src/impl.ts", "m/src/index.ts"]);

    const { byModule } = measureInterfaces(
      { changes: [huge, small], paths: files },
      refs,
      new Map([["m", ["m/src/index.ts"]]]),
    );

    expect(byModule.get("m")).toMatchObject({
      interfaceCommits: 1,
      implementationCommits: 1,
    });
  });
});

const churn = (leakage: number | null, implementationCommits: number) => ({
  entryPoints: ["m/index.ts"],
  interfaceCommits: 5,
  implementationCommits,
  leakage,
});

describe("isLeakyInterface", () => {
  it("flags leakage at the threshold over enough implementation commits", () => {
    expect(isLeakyInterface(churn(0.5, 5), false)).toBe(true);
  });

  it("does not flag leakage below the threshold", () => {
    expect(isLeakyInterface(churn(0.4999, 50), false)).toBe(false);
  });

  it("does not flag a high share of too few implementation commits", () => {
    expect(isLeakyInterface(churn(1, 4), false)).toBe(false);
  });

  it("does not flag a module without leakage data or a test-only one", () => {
    expect([
      isLeakyInterface(churn(null, 9), false),
      isLeakyInterface(churn(1, 9), true),
    ]).toStrictEqual([false, false]);
  });
});

const module = (path: string, overrides: Partial<Module>): Module => ({
  path,
  kind: "package",
  files: 3,
  testOnly: false,
  commits: 10,
  localCommits: 5,
  cohesion: 0.5,
  radius: 1,
  partners: [],
  entryPoints: [`${path}/index.ts`, `${path}/src/index.ts`],
  interfaceCommits: 5,
  implementationCommits: 10,
  leakage: 0.6,
  leakyInterface: true,
  depth: null,
  trend: null,
  erosion: null,
  fixDensity: null,
  ...overrides,
});

describe("leakingEntryPoints", () => {
  it("maps the leaked entry points of leaky modules to their module's leakage", () => {
    const modules = [module("a", {}), module("b", { leakyInterface: false })];

    const leaking = leakingEntryPoints(
      modules,
      new Set(["a/src/index.ts", "b/index.ts"]),
    );

    expect([...leaking]).toStrictEqual([["a/src/index.ts", 0.6]]);
  });
});
