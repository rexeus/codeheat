import { describe, expect, it } from "vitest";

import type { Coupling } from "../model/analysis.js";
import { propagationCost } from "./propagation-cost.js";
import type { ReachFile } from "./propagation-cost.js";

const file = (path: string, changes = 5): ReachFile => ({ path, changes });

const files = (...paths: ReadonlyArray<string>): ReadonlyArray<ReachFile> =>
  paths.map((path) => file(path));

const coupling = (a: string, b: string): Coupling => ({
  a,
  b,
  sharedCommits: 4,
  degree: 0.8,
  distance: 0,
  kinds: { a: "code", b: "code" },
  crossesModule: false,
  imports: null,
});

/** A coupling between every two of `paths`. */
const cliqueOf = (...paths: ReadonlyArray<string>): ReadonlyArray<Coupling> =>
  paths.flatMap((a, index) =>
    paths.slice(index + 1).map((b) => coupling(a, b)),
  );

/** A coupling between each file and the next one. */
const chainOf = (...paths: ReadonlyArray<string>): ReadonlyArray<Coupling> =>
  paths.slice(1).map((b, index) => coupling(paths[index] ?? "", b));

describe("propagationCost shapes", () => {
  it("follows a chain only as far as the depth limit", () => {
    // a..f in a line, depth 3 reaches 3 4 5 5 4 3 of the other 5 files: 24 / 5 / 6
    const chain = chainOf("a", "b", "c", "d", "e", "f");
    const all = files("a", "b", "c", "d", "e", "f");

    expect(propagationCost(all, chain, 3)).toStrictEqual({
      cost: 0.8,
      files: 6,
    });
    expect(propagationCost(all, chain, 5)).toStrictEqual({
      cost: 1,
      files: 6,
    });
    expect(propagationCost(all, chain, 1)).toStrictEqual({
      cost: 0.3333,
      files: 6,
    });
  });

  it("is 1 when every file couples to every other", () => {
    const all = files("a", "b", "c", "d");

    expect(propagationCost(all, cliqueOf("a", "b", "c", "d"))).toStrictEqual({
      cost: 1,
      files: 4,
    });
  });

  it("does not let two separate islands reach each other", () => {
    // each of six files reaches the two others of its island out of five
    const all = files("a", "b", "c", "d", "e", "f");
    const islands = [...cliqueOf("a", "b", "c"), ...cliqueOf("d", "e", "f")];

    expect(propagationCost(all, islands)).toStrictEqual({
      cost: 0.4,
      files: 6,
    });
  });
});

describe("propagationCost files", () => {
  it("counts a file that couples to nothing among the files it dilutes", () => {
    const all = files("a", "b", "c", "d", "e", "f", "g");
    const islands = [...cliqueOf("a", "b", "c"), ...cliqueOf("d", "e", "f")];

    expect(propagationCost(all, islands)).toStrictEqual({
      cost: 0.2857,
      files: 7,
    });
  });

  it("is 0 when files have enough history but none is coupled", () => {
    expect(propagationCost(files("a", "b", "c"), [])).toStrictEqual({
      cost: 0,
      files: 3,
    });
  });

  it("leaves out files with too few changes", () => {
    const all = [...files("a", "b", "c"), file("rare", 2)];
    const couplings = [...cliqueOf("a", "b", "c"), coupling("c", "rare")];

    expect(propagationCost(all, couplings)).toStrictEqual({
      cost: 1,
      files: 3,
    });
  });

  it("is null without two files that could be coupled", () => {
    expect(propagationCost([], [])).toBeNull();
    expect(propagationCost([file("a"), file("b", 2)], [])).toBeNull();
  });
});
