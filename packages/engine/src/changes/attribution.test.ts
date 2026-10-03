import { describe, expect, it } from "vitest";

import { mergesOf } from "./attribution.js";

/** Commits and their parents, listed newest first as `git log` prints them. */
const graphOf = (...rows: ReadonlyArray<readonly [string, ...Array<string>]>) =>
  new Map(rows.map(([commit, ...parents]) => [commit, parents]));

/** Pull request merges of feature branches. */
const branches = (...merges: ReadonlyArray<string>) =>
  new Map(merges.map((merge) => [merge, "branch" as const]));

const attribution = (
  graph: ReturnType<typeof graphOf>,
  tip: string,
  pullRequests: ReturnType<typeof branches>,
  squashed: ReadonlyArray<string> = [],
) => Object.fromEntries(mergesOf(graph, tip, pullRequests, new Set(squashed)));

describe("mergesOf", () => {
  it("maps the commits of a merged branch to the pull request merge", () => {
    const graph = graphOf(
      ["m", "main2", "f2"],
      ["main2", "main1"],
      ["f2", "f1"],
      ["f1", "main1"],
      ["main1"],
    );

    expect(attribution(graph, "m", branches("m"))).toStrictEqual({
      f2: "m/1",
      f1: "m/1",
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

    expect(attribution(graph, "m", branches("m"))).toStrictEqual({
      sync: "m/1",
      f1: "m/1",
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

    expect(attribution(graph, "m2", branches("m1", "m2"))).toStrictEqual({
      f1: "m1/1",
      f2: "m2/1",
    });
  });

  it("stops at commits outside the graph and maps nothing without a merge", () => {
    const graph = graphOf(["m", "main1", "f2"], ["f2", "f1"]);

    expect(attribution(graph, "m", branches("m"))).toStrictEqual({ f2: "m/1" });
    expect(
      attribution(graphOf(["b", "a"], ["a"]), "b", branches()),
    ).toStrictEqual({});
  });
});

describe("mergesOf merges that are no pull request", () => {
  it("groups nothing for a merge outside the pull requests", () => {
    const graph = graphOf(["m", "main1", "f1"], ["f1", "main1"], ["main1"]);

    expect(attribution(graph, "m", branches())).toStrictEqual({});
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

    expect(attribution(graph, "pull", branches("pr"))).toStrictEqual({
      p2: "pr/1",
      p1: "pr/1",
    });
  });

  it("gives each branch of an octopus merge its own owner", () => {
    const graph = graphOf(
      ["octopus", "main1", "a1", "b1"],
      ["a1", "main1"],
      ["b1", "main1"],
      ["main1"],
    );

    expect(attribution(graph, "octopus", branches("octopus"))).toStrictEqual({
      a1: "octopus/1",
      b1: "octopus/2",
    });
    expect(attribution(graph, "octopus", branches())).toStrictEqual({});
  });
});

describe("mergesOf long-lived branches", () => {
  it("does not let a pull request take the commits its integration branch had before the fork", () => {
    // develop (d1..d6) merged into main without a pull request; a1 forked at d2 and was merged back by pull request mi
    const graph = graphOf(
      ["m", "main1", "mi"],
      ["mi", "d6", "a1"],
      ["d6", "d5"],
      ["d5", "d4"],
      ["d4", "d3"],
      ["d3", "d2"],
      ["a1", "d2"],
      ["d2", "d1"],
      ["d1", "main1"],
      ["main1"],
    );

    expect(attribution(graph, "m", branches("mi"))).toStrictEqual({
      a1: "mi/1",
    });
  });

  it("leaves the direct commits of a branch that merged pull requests ungrouped (gitflow)", () => {
    // develop released by pull request M after pull requests mB and mA were merged into it; A forked before develop moved on
    const graph = graphOf(
      ["M", "base", "mA"],
      ["mA", "mB", "a1"],
      ["mB", "w", "b1"],
      ["b1", "w"],
      ["w", "z"],
      ["a1", "z"],
      ["z", "base"],
      ["base"],
    );

    expect(attribution(graph, "M", branches("M", "mA", "mB"))).toStrictEqual({
      a1: "mA/1",
      b1: "mB/1",
    });
  });
});

describe("mergesOf integration branches", () => {
  it("leaves the commits of a merged integration branch ungrouped", () => {
    const graph = graphOf(["m", "main1", "d2"], ["d2", "d1"], ["d1", "main1"]);

    expect(
      Object.fromEntries(
        mergesOf(graph, "m", new Map([["m", "integration"]]), new Set()),
      ),
    ).toStrictEqual({});
    expect(attribution(graph, "m", branches("m"))).toStrictEqual({
      d2: "m/1",
      d1: "m/1",
    });
  });

  it("still groups a pull request merged into a branch that is itself no pull request", () => {
    // develop released by plain merge m, with pull request A merged into it after develop had moved on
    const graph = graphOf(
      ["m", "main1", "mi"],
      ["mi", "d3", "a2"],
      ["d3", "d2"],
      ["a2", "a1"],
      ["a1", "d1"],
      ["d2", "d1"],
      ["d1", "main1"],
      ["main1"],
    );

    expect(attribution(graph, "m", branches("mi"))).toStrictEqual({
      a2: "mi/1",
      a1: "mi/1",
    });
  });
});

describe("mergesOf squash-merged pull requests", () => {
  it("leaves the direct commits of a branch ungrouped when they include a squash-merged pull request", () => {
    // Azure DevOps: the release pull request names no branch, and the features on develop are plain squash commits
    const graph = graphOf(
      ["M", "base", "d3"],
      ["d3", "d2"],
      ["d2", "d1"],
      ["d1", "base"],
      ["base"],
    );

    expect(attribution(graph, "M", branches("M"), ["d2"])).toStrictEqual({});
    expect(attribution(graph, "M", branches("M"))).toStrictEqual({
      d3: "M/1",
      d2: "M/1",
      d1: "M/1",
    });
  });

  it("still groups a pull request merged into such a branch", () => {
    const graph = graphOf(
      ["M", "base", "mi"],
      ["mi", "d2", "a1"],
      ["d2", "d1"],
      ["a1", "d1"],
      ["d1", "base"],
      ["base"],
    );

    expect(attribution(graph, "M", branches("M", "mi"), ["d1"])).toStrictEqual({
      a1: "mi/1",
    });
  });
});

describe("mergesOf merges inside a pull request", () => {
  it("keeps the commits a git pull brought into a pull request's branch with that pull request", () => {
    const graph = graphOf(
      ["m", "main1", "f3"],
      ["f3", "f2", "u1"],
      ["f2", "f1"],
      ["u1", "f1"],
      ["f1", "main1"],
      ["main1"],
    );

    expect(attribution(graph, "m", branches("m"))).toStrictEqual({
      f3: "m/1",
      f2: "m/1",
      u1: "m/1",
      f1: "m/1",
    });
  });

  it("still groups nothing for a git pull on the mainline", () => {
    const graph = graphOf(
      ["pull", "local1", "u1"],
      ["u1", "base"],
      ["local1", "base"],
      ["base"],
    );

    expect(attribution(graph, "pull", branches())).toStrictEqual({});
  });
});
