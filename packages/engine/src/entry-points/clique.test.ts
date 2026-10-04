import { describe, expect, it } from "vitest";

import type { Clique } from "../report/clique.js";
import type { Territory } from "../report/territory.js";
import { DEFAULT_THRESHOLDS } from "../testing/report-defaults.js";
import { territoryRecord } from "../testing/territory-record.js";
import { cliqueEntries as cliqueEntriesWith } from "./clique.js";

const territory = (id: string, heatShare: number) => ({
  ...territoryRecord(id, "package", "r"),
  path: `packages/${id}`,
  heatShare,
});

/** The production code's share of the heat: a lower one than `heatShare` for `a`, whose tests add heat. */
const CODE_HEAT = new Map([
  ["a", 0.2],
  ["b", 0.1],
  ["c", 0.05],
  ["d", 0.05],
  ["e", 0.05],
  ["f", 0.05],
]);

const cliqueEntries = (
  cliques: ReadonlyArray<Clique>,
  byId: ReadonlyMap<string, Territory>,
  codeHeat: ReadonlyMap<string, number> = CODE_HEAT,
) => cliqueEntriesWith(cliques, byId, codeHeat, DEFAULT_THRESHOLDS);

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
  it("scores the production code's heat of the members, as tight as the weakest pair, with the evidence of at least ten shared changes in full", () => {
    const [entry] = cliqueEntries([clique(["a", "b", "c"], 12, 0.5)], BY_ID);

    // (0.2 + 0.1 + 0.05) × 0.5
    expect(entry?.score).toBeCloseTo(0.175, 10);
    expect(entry?.kind).toBe("clique");
    expect(entry?.territories).toStrictEqual(["a", "b", "c"]);
    expect(entry?.files).toStrictEqual([]);
    expect(entry?.evidence).toStrictEqual({
      territories: 3,
      codeHeatShare: 0.35,
      heatShare: 0.45,
      weakestShare: 0.5,
      sharedChanges: 12,
    });
  });

  it("weighs a unit seen fewer than ten times in proportion", () => {
    const [entry] = cliqueEntries([clique(["a", "b", "c"], 4, 0.5)], BY_ID);

    expect(entry?.score).toBeCloseTo(0.07, 10);
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

  it("leaves out a clique with a member that is no territory, or whose members hold under two percent of the production code's heat, whatever heat their tests add", () => {
    const small = new Map([
      ["b", territory("b", 0.5)],
      ["c", territory("c", 0.5)],
      ["d", territory("d", 0.5)],
    ]);
    const smallCode = new Map([
      ["b", 0.01],
      ["c", 0.009],
      ["d", 0],
    ]);

    expect(
      cliqueEntries([clique(["a", "b", "x"], 12, 0.5)], BY_ID),
    ).toStrictEqual([]);
    expect(
      cliqueEntries([clique(["b", "c", "d"], 12, 0.5)], small, smallCode),
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

describe("cliqueEntries of different sizes", () => {
  it("drops a clique when half or more of its own territories are in a better one, whatever the size of the better", () => {
    const entries = cliqueEntries(
      [clique(["a", "b", "e"], 12, 0.5), clique(["a", "b", "c", "d"], 12, 0.5)],
      BY_ID,
    );

    expect(entries.map(({ territories }) => territories)).toStrictEqual([
      ["a", "b", "c", "d"],
    ]);
  });
});
