import { describe, expect, it } from "vitest";

import type { Module } from "../report/module.js";
import { leakyEntryPoints } from "./interface-churn.js";

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
