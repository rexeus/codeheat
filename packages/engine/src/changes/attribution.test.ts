import { describe, expect, it } from "vitest";

import { mergesOf } from "./attribution.js";

/** Commits and their parents, listed newest first as `git log` prints them. */
const graphOf = (...rows: ReadonlyArray<readonly [string, ...Array<string>]>) =>
  new Map(rows.map(([commit, ...parents]) => [commit, parents]));

describe("mergesOf", () => {
  it("maps the commits of a merged branch to the merge", () => {
    const graph = graphOf(
      ["m", "main2", "f2"],
      ["main2", "main1"],
      ["f2", "f1"],
      ["f1", "main1"],
      ["main1"],
    );

    expect(Object.fromEntries(mergesOf(graph, "m"))).toStrictEqual({
      f2: "m",
      f1: "m",
    });
  });

  it("gives a branch merged into another branch to its own merge", () => {
    const graph = graphOf(
      ["outer", "main1", "d2"],
      ["d2", "inner"],
      ["inner", "d1", "f1"],
      ["f1", "d1"],
      ["d1", "main1"],
      ["main1"],
    );

    expect(Object.fromEntries(mergesOf(graph, "outer"))).toStrictEqual({
      d2: "outer",
      inner: "outer",
      d1: "outer",
      f1: "inner",
    });
  });

  it("leaves the commits that a branch took from the mainline on the mainline", () => {
    const graph = graphOf(
      ["m", "main2", "sync"],
      ["main2", "main1"],
      ["sync", "f1", "main2"],
      ["f1", "main1"],
      ["main1"],
    );

    expect(Object.fromEntries(mergesOf(graph, "m"))).toStrictEqual({
      sync: "m",
      f1: "m",
    });
  });

  it("gives a commit that two merges reach to the older merge", () => {
    const graph = graphOf(
      ["m2", "m1", "f2"],
      ["m1", "main1", "f1"],
      ["f2", "f1"],
      ["f1", "main1"],
      ["main1"],
    );

    expect(Object.fromEntries(mergesOf(graph, "m2"))).toStrictEqual({
      f1: "m1",
      f2: "m2",
    });
  });
});

describe("mergesOf limits", () => {
  it("stops at commits outside the graph", () => {
    const graph = graphOf(["m", "main1", "f2"], ["f2", "f1"]);

    expect(Object.fromEntries(mergesOf(graph, "m"))).toStrictEqual({
      f2: "m",
    });
  });

  it("maps nothing when the line has no merge", () => {
    expect(mergesOf(graphOf(["b", "a"], ["a"]), "b").size).toBe(0);
  });
});
