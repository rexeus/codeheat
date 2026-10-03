import { describe, expect, it } from "vitest";

import { moduleRecord } from "../testing/module-record.js";
import { findCliques } from "./cliques.js";
import { moduleCoChange } from "./module-co-change.js";

/** `count` commits that each touched exactly `paths`. */
const commitsOf = (
  count: number,
  ...paths: ReadonlyArray<string>
): ReadonlyArray<ReadonlySet<string>> =>
  Array.from({ length: count }, () => new Set(paths));

/** Modules a to e with ten counted commits each, ranked from five up. */
const MODULES = ["a", "b", "c", "d", "e"].map((path) => moduleRecord(path, 10));

const cliquesOf = (touched: ReadonlyArray<ReadonlySet<string>>) =>
  findCliques(moduleCoChange(touched, MODULES, 5), touched).cliques;

describe("findCliques membership", () => {
  it("finds a triangle whose every pair shares enough, with the commits that touched all three", () => {
    const touched = [
      ...commitsOf(6, "a", "b", "c"),
      ...commitsOf(4, "a"),
      ...commitsOf(4, "b"),
      ...commitsOf(4, "c"),
    ];

    expect(cliquesOf(touched)).toEqual([
      {
        modules: ["a", "b", "c"],
        sharedCommits: 6,
        weakestShare: 0.6,
        reason:
          "3 modules of which every pair shares at least 60% of the smaller one's commits; 6 commits touched all of them",
      },
    ]);
  });

  it("finds no clique when one pair of three falls below thirty percent of the smaller module", () => {
    const touched = [
      ...commitsOf(6, "a", "b"),
      ...commitsOf(6, "b", "c"),
      ...commitsOf(2, "a", "c"),
    ];

    expect(cliquesOf(touched)).toEqual([]);
  });

  it("accepts pairs at exactly thirty percent of the smaller module", () => {
    const touched = commitsOf(3, "a", "b", "c");

    expect(
      cliquesOf([...touched, ...commitsOf(7, "a")]).map(
        ({ modules, weakestShare }) => [modules, weakestShare],
      ),
    ).toEqual([[["a", "b", "c"], 0.3]]);
  });

  it("finds no clique when every pair meets but no three commits touched all members", () => {
    const touched = [
      ...commitsOf(5, "a", "b"),
      ...commitsOf(5, "b", "c"),
      ...commitsOf(5, "a", "c"),
    ];

    expect(cliquesOf(touched)).toEqual([]);
  });
});

describe("findCliques overlap", () => {
  it("reports a clique of four once, not the four triangles inside it", () => {
    const touched = commitsOf(5, "a", "b", "c", "d");

    expect(cliquesOf(touched).map(({ modules }) => modules)).toEqual([
      ["a", "b", "c", "d"],
    ]);
  });

  it("reports two triangles that share an edge when their other members never change together", () => {
    const touched = [
      ...commitsOf(5, "a", "b", "c"),
      ...commitsOf(4, "b", "c", "d"),
    ];

    expect(cliquesOf(touched).map(({ modules }) => modules)).toEqual([
      ["a", "b", "c"],
      ["b", "c", "d"],
    ]);
  });

  it("reports the groups that share a core pair and each add a module of their own", () => {
    const touched = [
      ...commitsOf(9, "core", "api", "web"),
      ...commitsOf(6, "core", "api", "mobile"),
      ...commitsOf(5, "core", "api", "admin"),
    ];
    const modules = ["core", "api", "web", "mobile", "admin"].map((path) =>
      moduleRecord(path, 15),
    );

    expect(
      findCliques(moduleCoChange(touched, modules, 5), touched).cliques.map(
        (clique) => clique.modules,
      ),
    ).toEqual([
      ["api", "core", "web"],
      ["api", "core", "mobile"],
      ["admin", "api", "core"],
    ]);
  });

  it("reports two triangles that share a single module as two cliques", () => {
    const touched = [
      ...commitsOf(5, "a", "b", "c"),
      ...commitsOf(4, "c", "d", "e"),
    ];

    expect(cliquesOf(touched).map(({ modules }) => modules)).toEqual([
      ["a", "b", "c"],
      ["c", "d", "e"],
    ]);
  });
});

describe("findCliques exclusions and ranking", () => {
  it("ignores a pair of modules, however tightly it changes together", () => {
    expect(cliquesOf(commitsOf(9, "a", "b"))).toEqual([]);
  });

  it("leaves out a module below the commit floor and a test-only module", () => {
    const modules = [
      moduleRecord("a", 10),
      moduleRecord("b", 10),
      moduleRecord("small", 4),
      moduleRecord("tests", 10, true),
    ];
    const touched = [
      ...commitsOf(4, "a", "b", "small"),
      ...commitsOf(4, "a", "b", "tests"),
    ];

    expect(
      findCliques(moduleCoChange(touched, modules, 5), touched).cliques,
    ).toEqual([]);
  });

  it("ranks the clique whose members changed together in more commits first", () => {
    const touched = [
      ...commitsOf(4, "a", "b", "c"),
      ...commitsOf(7, "c", "d", "e"),
    ];

    expect(cliquesOf(touched).map(({ modules }) => modules)).toEqual([
      ["c", "d", "e"],
      ["a", "b", "c"],
    ]);
  });
});

describe("findCliques sub-groups", () => {
  it("finds the triple that changed together inside a group of four whose members never all met", () => {
    const touched = [
      ...commitsOf(5, "a", "b", "c"),
      ...commitsOf(3, "d", "a"),
      ...commitsOf(3, "d", "b"),
      ...commitsOf(3, "d", "c"),
    ];

    expect(
      cliquesOf(touched).map(({ modules, sharedCommits }) => [
        modules,
        sharedCommits,
      ]),
    ).toEqual([[["a", "b", "c"], 5]]);
  });

  it("keeps one of two overlapping triples inside a group of four, the first by path on a tie", () => {
    const touched = [
      ...commitsOf(4, "a", "b", "c"),
      ...commitsOf(4, "b", "c", "d"),
      ...commitsOf(3, "a", "d"),
    ];

    expect(
      cliquesOf(touched).map(({ modules, sharedCommits }) => [
        modules,
        sharedCommits,
      ]),
    ).toEqual([[["a", "b", "c"], 4]]);
  });

  it("reports a supported group of four without its supported triples", () => {
    const touched = [
      ...commitsOf(4, "a", "b", "c", "d"),
      ...commitsOf(3, "a", "b", "c"),
    ];

    expect(
      cliquesOf(touched).map(({ modules, sharedCommits }) => [
        modules,
        sharedCommits,
      ]),
    ).toEqual([[["a", "b", "c", "d"], 4]]);
  });

  it("finds the modules that different commits have in common when no single kind of commit repeats enough", () => {
    const touched = [
      ...commitsOf(2, "a", "b", "c", "d"),
      ...commitsOf(2, "a", "b", "c", "e"),
      ...commitsOf(3, "d", "e"),
      ...["d", "e"].flatMap((other) =>
        ["a", "b", "c"].flatMap((member) => commitsOf(1, other, member)),
      ),
    ];

    expect(
      cliquesOf(touched).map(({ modules, sharedCommits }) => [
        modules,
        sharedCommits,
      ]),
    ).toEqual([[["a", "b", "c"], 4]]);
  });
});

/** 2k modules in k pairs that never change together, every other pair of modules changing together in three commits. */
const adversarial = (pairs: number) => {
  const names = Array.from(
    { length: 2 * pairs },
    (_, index) => `m${String(index).padStart(2, "0")}`,
  );
  const touched = names.flatMap((low, i) =>
    names
      .slice(i + 1)
      .filter((_, j) => !(i % 2 === 0 && j === 0))
      .flatMap((high) => commitsOf(3, low, high)),
  );
  const modules = names.map((path) => moduleRecord(path, 10));
  return findCliques(moduleCoChange(touched, modules, 5), touched);
};

describe("findCliques bounds", () => {
  it("gives up on a graph with thousands of maximal groups, says so, and stays fast", () => {
    const start = performance.now();
    const found = adversarial(12);
    const seconds = (performance.now() - start) / 1000;

    expect(found.partial).toBe(true);
    expect(seconds).toBeLessThan(10);
  });

  it("is not partial for a graph well within the bounds", () => {
    expect(adversarial(4).partial).toBe(false);
  });
});
