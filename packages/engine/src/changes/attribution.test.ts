import { describe, expect, it } from "vitest";

import { mergesOf } from "./attribution.js";

/** Commits and their parents, listed newest first as `git log` prints them. */
const graphOf = (...rows: ReadonlyArray<readonly [string, ...Array<string>]>) =>
  new Map(rows.map(([commit, ...parents]) => [commit, parents]));

describe("mergesOf", () => {
  it("maps the commits of a merged branch to the pull request merge", () => {
    const graph = graphOf(
      ["m", "main2", "f2"],
      ["main2", "main1"],
      ["f2", "f1"],
      ["f1", "main1"],
      ["main1"],
    );

    expect(
      Object.fromEntries(mergesOf(graph, "m", new Set(["m"]))),
    ).toStrictEqual({ f2: "m/1", f1: "m/1" });
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

    expect(
      Object.fromEntries(mergesOf(graph, "outer", new Set(["outer", "inner"]))),
    ).toStrictEqual({
      d2: "outer/1",
      inner: "outer/1",
      d1: "outer/1",
      f1: "inner/1",
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

    expect(
      Object.fromEntries(mergesOf(graph, "m", new Set(["m", "sync"]))),
    ).toStrictEqual({ sync: "m/1", f1: "m/1" });
  });

  it("gives a commit that two merges reach to the older merge", () => {
    const graph = graphOf(
      ["m2", "m1", "f2"],
      ["m1", "main1", "f1"],
      ["f2", "f1"],
      ["f1", "main1"],
      ["main1"],
    );

    expect(
      Object.fromEntries(mergesOf(graph, "m2", new Set(["m1", "m2"]))),
    ).toStrictEqual({ f1: "m1/1", f2: "m2/1" });
  });
});

describe("mergesOf merges that are no pull request", () => {
  it("groups nothing for a merge outside the pull requests", () => {
    const graph = graphOf(["m", "main1", "f1"], ["f1", "main1"], ["main1"]);

    expect(mergesOf(graph, "m", new Set()).size).toBe(0);
  });

  it("still groups a pull request merged inside the branches of such a merge", () => {
    // `git pull` merged upstream (u3, then the pull request merge pr, then u1) into the local line
    const graph = graphOf(
      ["pull", "local1", "u3"],
      ["u3", "pr"],
      ["pr", "u1", "p2"],
      ["p2", "p1"],
      ["p1", "u1"],
      ["u1", "base"],
      ["local1", "base"],
      ["base"],
    );

    expect(
      Object.fromEntries(mergesOf(graph, "pull", new Set(["pr"]))),
    ).toStrictEqual({ p2: "pr/1", p1: "pr/1" });
  });

  it("gives each branch of an octopus merge its own owner", () => {
    const graph = graphOf(
      ["octopus", "main1", "a1", "b1"],
      ["a1", "main1"],
      ["b1", "main1"],
      ["main1"],
    );

    expect(
      Object.fromEntries(mergesOf(graph, "octopus", new Set(["octopus"]))),
    ).toStrictEqual({ a1: "octopus/1", b1: "octopus/2" });
    expect(mergesOf(graph, "octopus", new Set()).size).toBe(0);
  });
});

describe("mergesOf limits", () => {
  it("stops at commits outside the graph", () => {
    const graph = graphOf(["m", "main1", "f2"], ["f2", "f1"]);

    expect(
      Object.fromEntries(mergesOf(graph, "m", new Set(["m"]))),
    ).toStrictEqual({ f2: "m/1" });
  });

  it("maps nothing when the line has no merge", () => {
    expect(mergesOf(graphOf(["b", "a"], ["a"]), "b", new Set()).size).toBe(0);
  });
});
