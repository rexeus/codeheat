import { describe, expect, it } from "vitest";

import type { CopyFamily } from "../report/copy-family.js";
import type { Coupling } from "../report/report.js";
import type { Territories } from "../report/territory.js";
import { fileRecord } from "../testing/file-record.js";
import { DEFAULT_THRESHOLDS } from "../testing/report-defaults.js";
import { fitRecord, territoryRecord } from "../testing/territory-record.js";
import type { EntryPointInput } from "./gather-candidates.js";
import { rankEntryPoints } from "./rank-entry-points.js";

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

/** A coupling of two files that no import links. */
const hidden = (a: string, b: string): Coupling => ({
  a,
  b,
  sharedCommits: 8,
  degree: 0.5,
  distance: 2,
  testPair: false,
  kinds: { a: "code", b: "code" },
  crossesModule: true,
  imports: "none",
});

/** Four units that share one territory at most, so none is the same unit as another. */
const FOUR_UNITS = [
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
const FOUR_HUBS = [10, 8, 6, 4].map((changedDependents) => ({
  path: `lib/hub${changedDependents}.ts`,
  module: "lib",
  fanIn: 20,
  changes: 10,
  medianDependentChanges: 2,
  changedDependents,
  dependents: [],
  reason: "",
}));

/** A file with `heat` units of heat and no other trait. */
const heated = (path: string, territory: string, heat: number) =>
  fileRecord(path, territory, {
    changes: 1,
    loc: heat,
    complexity: { total: 0, mean: 0, max: 0 },
  });

/** Files holding 1000 units of heat; the two copies hold 10 each. */
const HEAT_FILES = [
  heated("a/x.ts", "a", 10),
  heated("b/x.ts", "b", 10),
  heated("c/x.ts", "c", 980),
];

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
  couplings: [],
  unstableInterfaces: [],
  minChanges: 10,
  limits: DEFAULT_THRESHOLDS,
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
    const ranked = rankEntryPoints(
      input({ files: HEAT_FILES, copyFamilies: [copies()] }),
    );

    // the copies score 0.02, below every boundary, yet they are listed
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
});

describe("rankEntryPoints of couplings and the cap", () => {
  it("finds the hidden couplings between the real territories of the recommended detail", () => {
    const ranked = rankEntryPoints(
      input({
        territories: territories(["package", "other"]),
        files: [
          heated("a/x.ts", "a", 100),
          heated("c/x.ts", "c", 100),
          heated("b/x.ts", "b", 100),
        ],
        couplings: [hidden("a/x.ts", "c/x.ts"), hidden("a/x.ts", "b/x.ts")],
      }),
    );

    expect(
      ranked
        .filter(({ kind }) => kind === "coupling")
        .map(({ files, territories: ids }) => [files, ids]),
    ).toStrictEqual([
      [
        ["a/x.ts", "c/x.ts"],
        ["a", "c"],
      ],
    ]);
  });

  it("lists ten entries at most, the best of each kind among them", () => {
    const ranked = rankEntryPoints(
      input({
        files: [
          ...FOUR_HUBS.map(({ path }) => heated(path, "a", 100)),
          heated("c/x.ts", "c", 600),
        ],
        cliques: FOUR_UNITS,
        unstableInterfaces: FOUR_HUBS,
      }),
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

describe("rankEntryPoints of one territory", () => {
  it("makes one entry of a territory that is both a boundary and a hotspot, with both findings, the stronger first", () => {
    const chronic = { kind: "chronic" as const, hotWindows: 5, windows: 6 };
    const both = territories();
    const ranked = rankEntryPoints(
      input({
        territories: {
          ...both,
          nodes: both.nodes.map((node) =>
            node.id === "a"
              ? Object.assign({}, node, {
                  fit: fitRecord({ containment: 0.1, chronicShare: 0.6 }),
                })
              : node,
          ),
        },
        files: [fileRecord("a/hot.ts", "a", { heat: chronic, score: 0.9 })],
      }),
    );

    const [first] = ranked;
    expect(
      ranked.filter(({ territories: ids }) => ids[0] === "a"),
    ).toHaveLength(1);
    // boundary 0.1 × 0.9 × 1.5 = 0.135 against hotspot 0.1 × 0.6 = 0.06
    expect(first?.kind).toBe("boundary");
    expect(first?.score).toBe(0.135);
    expect(first?.files).toStrictEqual([]);
    expect(
      first?.findings.map(({ kind, files }) => [kind, files]),
    ).toStrictEqual([
      ["boundary", []],
      ["hotspot", ["a/hot.ts"]],
    ]);
  });

  it("reads the cap on the entries from the limits", () => {
    expect(
      rankEntryPoints(
        input({ limits: { ...DEFAULT_THRESHOLDS, maxEntries: 2 } }),
      ),
    ).toHaveLength(2);
  });
});
