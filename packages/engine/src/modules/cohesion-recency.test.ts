import { describe, expect, it } from "vitest";

import { measureModules } from "./cohesion.js";
import type { ModuleRef } from "./detect.js";

const PATHS = ["a/a.ts", "b/b.ts"];
const HOMES = new Map<string, ModuleRef>([
  ["a/a.ts", { path: "a", kind: "directory" }],
  ["b/b.ts", { path: "b", kind: "directory" }],
]);

/** `count` changes of the given weight touching the files with these ids. */
const commits = (count: number, weight: number, ...ids: Array<number>) =>
  Array.from({ length: count }, () => ({
    files: Uint32Array.from(ids),
    size: ids.length,
    weight,
  }));

const measure = (history: ReturnType<typeof commits>) =>
  measureModules(
    { changes: history, paths: PATHS },
    { modules: HOMES, contracts: new Map() },
    5,
    new Map(),
  );

describe("measureModules recency", () => {
  it("measures cohesion by weight, shrunk towards the plain share", () => {
    // a: two old commits shared with b (0.25 each) and two recent ones of its own (1 each)
    const modules = measure([...commits(2, 0.25, 0, 1), ...commits(2, 1, 0)]);

    // least cohesive first
    // b: 2 commits, none local, weighted 0.5
    // a: 4 commits, 2 local, weighted 2.5 and 2, plain 0.5; (2 + 3 × 0.5) / (2.5 + 3) = 0.6364
    expect(
      modules.map(
        ({
          path,
          commits: count,
          localCommits,
          weightedCommits,
          weightedLocalCommits,
          cohesion,
        }) => [
          path,
          count,
          localCommits,
          weightedCommits,
          weightedLocalCommits,
          cohesion,
        ],
      ),
    ).toStrictEqual([
      ["b", 2, 0, 0.5, 0, 0],
      ["a", 4, 2, 2.5, 2, 0.6364],
    ]);
  });

  it("keeps the shared commits of a partner a plain count", () => {
    const a = measure(commits(3, 0.25, 0, 1)).find(({ path }) => path === "a");

    expect(a?.partners).toStrictEqual([
      { path: "b", sharedCommits: 3, contractsOnly: false },
    ]);
  });
});

describe("measureModules recency prior", () => {
  it("keeps a module with a few old local commits and one recent cross-module commit near its plain cohesion", () => {
    // a: 4 old commits of its own (0.001 each) and one recent commit shared with b (1)
    // weighted alone: 0.004 / 1.004 = 0.004; plain 4 / 5 = 0.8
    // (0.004 + 3 × 0.8) / (1.004 + 3) = 0.6004
    const a = measure([...commits(4, 0.001, 0), ...commits(1, 1, 0, 1)]).find(
      ({ path }) => path === "a",
    );

    expect(a?.cohesion).toBe(0.6004);
  });

  it("follows the weighted cohesion of a module with many recent commits", () => {
    // a: 20 recent commits of its own (1 each) and 10 old commits shared with b (0.01 each)
    // weighted 20 / 20.1 = 0.995; plain 20 / 30 = 0.6667
    // (20 + 3 × 0.6667) / (20.1 + 3) = 0.9524
    const a = measure([...commits(20, 1, 0), ...commits(10, 0.01, 0, 1)]).find(
      ({ path }) => path === "a",
    );

    expect(a?.cohesion).toBe(0.9524);
  });

  it("measures cohesion over ancient commits as their plain share", () => {
    // all weigh the smallest possible amount: the prior makes the share the plain one
    const a = measure([
      ...commits(1, 1e-300, 0, 1),
      ...commits(3, 1e-300, 0),
    ]).find(({ path }) => path === "a");

    expect(a?.cohesion).toBe(0.75);
  });

  it("equals the plain share when every commit weighs 1", () => {
    // a: 7 commits, 3 local, ranked first; b: 4 commits, none local
    const modules = measure([...commits(3, 1, 0), ...commits(4, 1, 0, 1)]);

    expect(modules.map(({ path, cohesion }) => [path, cohesion])).toStrictEqual(
      [
        ["a", 0.4286],
        ["b", 0],
      ],
    );
  });

  it("reports the plain share, rounded like the plain share, when every commit weighs 1", () => {
    // 129 of 160 commits are local: 0.80625 exactly, which rounds up to 0.8063
    const a = measure([...commits(129, 1, 0), ...commits(31, 1, 0, 1)]).find(
      ({ path }) => path === "a",
    );

    expect(a?.cohesion).toBe(0.8063);
  });
});
