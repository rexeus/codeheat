import { describe, expect, it } from "vitest";

import type { CopyFamily } from "../report/copy-family.js";
import type { Territories } from "../report/territory.js";
import { fitRecord, territoryRecord } from "../testing/territory-record.js";
import { rankEntryPoints } from "./rank-entry-points.js";
import type { EntryPointInput } from "./rank-entry-points.js";

const IDS = ["a", "b", "c", "d", "e", "f"];

/** Six packages, `a` the leakiest and `f` the least: their heat is 0.1 each. */
const territories = (
  kinds: ReadonlyArray<"package" | "other"> = [],
): Territories => ({
  recommended: 1,
  details: [{ level: 1, ids: IDS }],
  nodes: [
    territoryRecord("r", "folder", null, IDS),
    ...IDS.map((id, index) =>
      Object.assign(territoryRecord(id, kinds[index] ?? "package", "r"), {
        heatShare: 0.1,
        changes: 40,
        fit: fitRecord({ containment: 0.1 + index / 10 }),
      }),
    ),
  ],
});

const copies = (): CopyFamily => ({
  files: ["a/x.ts", "b/x.ts"],
  similarity: { min: 0.8, max: 0.9 },
  testOnly: false,
  sharedChanges: 5,
  changesToAll: 5,
});

const input = (overrides: Partial<EntryPointInput> = {}): EntryPointInput => ({
  territories: territories(),
  files: [],
  cliques: [],
  copyFamilies: [],
  unstableInterfaces: [],
  changes: 1000,
  minChanges: 10,
  ...overrides,
});

describe("rankEntryPoints", () => {
  it("ranks by score from 1", () => {
    const ranked = rankEntryPoints(input());

    expect(
      ranked.map(({ rank, kind, territories: ids }) => [rank, kind, ids]),
    ).toStrictEqual([
      [1, "boundary", ["a"]],
      [2, "boundary", ["b"]],
      [3, "boundary", ["c"]],
      [4, "boundary", ["d"]],
    ]);
    expect(ranked.map(({ score }) => score)).toStrictEqual([
      0.09, 0.08, 0.07, 0.06,
    ]);
  });

  it("lists at most four of a kind, but always the best of every kind", () => {
    const ranked = rankEntryPoints(input({ copyFamilies: [copies()] }));

    // the copies score 0.005, below every boundary, yet they are listed
    expect(ranked.map(({ kind }) => kind)).toStrictEqual([
      "boundary",
      "boundary",
      "boundary",
      "boundary",
      "copies",
    ]);
    expect(ranked.at(-1)?.rank).toBe(5);
  });

  it("is empty when nothing qualifies", () => {
    expect(
      rankEntryPoints(input({ territories: territories([]), minChanges: 41 })),
    ).toStrictEqual([]);
  });
});

describe("rankEntryPoints candidates", () => {
  it("judges only territories at the recommended detail that are real", () => {
    const ranked = rankEntryPoints(
      input({ territories: territories(["other", "other"]) }),
    );

    expect(ranked.flatMap(({ territories: ids }) => ids)).toStrictEqual([
      "c",
      "d",
      "e",
      "f",
    ]);
  });

  it("lists ten entries at most, the best of each kind among them", () => {
    // four units that share one territory at most, so none is the same unit as another
    const cliques = [
      ["a", "b", "c"],
      ["a", "d", "e"],
      ["b", "d", "f"],
      ["c", "e", "f"],
    ].map((modules, index) => ({
      modules,
      sharedCommits: 10,
      weakestShare: 0.5 - index / 10,
      reason: "",
    }));
    const hubs = [10, 8, 6, 4].map((changedDependents) => ({
      path: `lib/hub${changedDependents}.ts`,
      module: "lib",
      fanIn: 20,
      changes: 10,
      medianDependentChanges: 2,
      changedDependents,
      dependents: [],
      reason: "",
    }));

    const ranked = rankEntryPoints(
      input({ cliques, unstableInterfaces: hubs }),
    );

    expect(ranked).toHaveLength(10);
    expect(ranked.map(({ rank }) => rank)).toStrictEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ]);
    expect(
      ranked.map(({ kind }) => kind).filter((kind) => kind === "hub").length,
    ).toBeGreaterThanOrEqual(1);
    expect(ranked.map(({ score }) => score)).toStrictEqual(
      ranked.map(({ score }) => score).toSorted((x, y) => y - x),
    );
  });
});
