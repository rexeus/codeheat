import { describe, expect, it } from "vitest";

import type { Clique } from "../report/clique.js";
import { territoryRecord } from "../testing/territory-record.js";
import { cliqueEntries } from "./clique.js";

const territory = (id: string, heatShare: number) => ({
  ...territoryRecord(id, "package", "r"),
  path: `packages/${id}`,
  heatShare,
});

const BY_ID = new Map(
  [
    territory("a", 0.3),
    territory("b", 0.1),
    territory("c", 0.05),
    territory("d", 0.05),
    territory("e", 0.05),
    territory("f", 0.05),
  ].map((node) => [node.id, node]),
);

const clique = (
  modules: ReadonlyArray<string>,
  sharedCommits: number,
  weakestShare: number,
): Clique => ({ modules, sharedCommits, weakestShare, reason: "" });

describe("cliqueEntries", () => {
  it("scores the heat of the members, as tight as the weakest pair, with the evidence of at least ten shared changes in full", () => {
    const [entry] = cliqueEntries([clique(["a", "b", "c"], 12, 0.5)], BY_ID);

    expect(entry?.score).toBeCloseTo(0.225, 10);
    expect(entry?.kind).toBe("clique");
    expect(entry?.territories).toStrictEqual(["a", "b", "c"]);
    expect(entry?.files).toStrictEqual([]);
    expect(entry?.evidence).toStrictEqual({
      territories: 3,
      heatShare: 0.45,
      weakestShare: 0.5,
      sharedChanges: 12,
    });
  });

  it("weighs a unit seen fewer than ten times in proportion", () => {
    const [entry] = cliqueEntries([clique(["a", "b", "c"], 4, 0.5)], BY_ID);

    expect(entry?.score).toBeCloseTo(0.09, 10);
  });

  it("says what to do with the names of the members", () => {
    const [entry] = cliqueEntries([clique(["a", "b", "c"], 12, 0.5)], BY_ID);

    expect(entry?.verdict).toBe(
      "These territories change as one unit across their boundaries.",
    );
    expect(entry?.designMove).toBe(
      "Extract a shared abstraction: find what packages/a, packages/b, and packages/c all change for and give it one home that they use, or redraw the boundaries around it.",
    );
  });

  it("leaves out a clique with a member that is no territory, or whose members hold under two percent of the heat", () => {
    const small = new Map([
      ["b", territory("b", 0.01)],
      ["c", territory("c", 0.009)],
      ["d", territory("d", 0)],
    ]);

    expect(
      cliqueEntries([clique(["a", "b", "x"], 12, 0.5)], BY_ID),
    ).toStrictEqual([]);
    expect(
      cliqueEntries([clique(["b", "c", "d"], 12, 0.5)], small),
    ).toStrictEqual([]);
  });
});

describe("cliqueEntries of one unit", () => {
  it("lists the better of two cliques that share half of their territories, and keeps one that shares less", () => {
    const entries = cliqueEntries(
      [
        clique(["a", "b", "d"], 12, 0.3),
        clique(["a", "b", "c"], 12, 0.5),
        clique(["a", "e", "f"], 12, 0.4),
      ],
      BY_ID,
    );

    expect(entries.map(({ territories }) => territories)).toStrictEqual([
      ["a", "b", "c"],
      ["a", "e", "f"],
    ]);
  });
});
