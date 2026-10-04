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

/** Six packages, `a` the leakiest and `f` the least. */
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

/** Every territory holds 1000 of the 6000 units of the production code's heat. */
const CODE_FILES = IDS.map((id) => heated(`${id}/main.ts`, id, 1000));

/** The two copies hold 30 more units each. */
const COPY_FILES = [heated("a/x.ts", "a", 30), heated("b/x.ts", "b", 30)];

const copies = (): CopyFamily => ({
  files: ["a/x.ts", "b/x.ts"],
  similarity: { min: 0.8, max: 0.9 },
  testOnly: false,
  sharedChanges: 5,
  changesToAll: 5,
});

const input = (overrides: Partial<EntryPointInput> = {}): EntryPointInput => ({
  territories: territories(),
  files: CODE_FILES,
  cliques: [],
  copyFamilies: [],
  couplings: [],
  unstableInterfaces: [],
  minChanges: 10,
  limits: DEFAULT_THRESHOLDS,
  ...overrides,
});

describe("rankEntryPoints", () => {
  it("ranks by score from 1, on the share of the production code's heat that leaks", () => {
    const ranked = rankEntryPoints(input());

    // a sixth of the heat each, times 0.9 down to 0.4 of it leaking
    expect(
      ranked.map(({ rank, kind, territories: ids }) => [rank, kind, ids]),
    ).toStrictEqual([
      [1, "boundary", ["a"]],
      [2, "boundary", ["b"]],
      [3, "boundary", ["c"]],
      [4, "boundary", ["d"]],
      [5, "boundary", ["e"]],
      [6, "boundary", ["f"]],
    ]);
    expect(ranked.map(({ score }) => score)).toStrictEqual([
      0.15, 0.1333, 0.1167, 0.1, 0.0833, 0.0667,
    ]);
  });

  it("does not rank a territory made of test code, whatever heat share it has", () => {
    const ranked = rankEntryPoints(
      input({
        files: [
          ...CODE_FILES.filter(({ territory }) => territory !== "a"),
          fileRecord("a/main.test.ts", "a", { test: true }),
        ],
      }),
    );

    expect(ranked.flatMap(({ territories: ids }) => ids)).not.toContain("a");
  });

  it("lists at most the limit of a kind, but always the best of every kind", () => {
    const ranked = rankEntryPoints(
      input({
        files: [...CODE_FILES, ...COPY_FILES],
        copyFamilies: [copies()],
        limits: { ...DEFAULT_THRESHOLDS, maxEntriesPerKind: 4 },
      }),
    );

    // the copies score about 0.0099, below every boundary, yet they are listed
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

const floored = () =>
  rankEntryPoints(
    input({
      files: [...CODE_FILES, ...COPY_FILES],
      copyFamilies: [copies()],
      limits: { ...DEFAULT_THRESHOLDS, minEntryScore: 0.09 },
    }),
  );

describe("rankEntryPoints floor", () => {
  it("leaves out an entry below the least score", () => {
    expect(floored().map(({ score }) => score)).toStrictEqual([
      0.153, 0.136, 0.1155, 0.099, 0.0099,
    ]);
  });

  it("keeps the best entry of a kind that never reaches it", () => {
    expect(floored().map(({ kind }) => kind)).toContain("copies");
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
          ...CODE_FILES,
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
          ...CODE_FILES,
          ...FOUR_HUBS.map(({ path }) => heated(path, "a", 100)),
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

describe("rankEntryPoints of repeats", () => {
  it("leaves out an entry about files that a higher ranked entry names all of", () => {
    const ranked = rankEntryPoints(
      input({
        files: [...CODE_FILES, ...COPY_FILES],
        copyFamilies: [copies()],
        couplings: [hidden("a/x.ts", "b/x.ts")],
      }),
    );

    // the coupling of the two copies scores less than the copies, which name both
    expect(
      ranked.map(({ kind }) => kind).filter((kind) => kind !== "boundary"),
    ).toStrictEqual(["copies"]);
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
        files: [
          ...CODE_FILES,
          fileRecord("a/hot.ts", "a", { heat: chronic, score: 0.9 }),
        ],
      }),
    );

    const [first] = ranked;
    expect(
      ranked.filter(({ territories: ids }) => ids[0] === "a"),
    ).toHaveLength(1);
    // heat of a: (1000 + 1500) / 7500; boundary a third × 0.9 × 1.5 = 0.45
    // against hotspot 1500 / 7500 = 0.2
    expect(first?.kind).toBe("boundary");
    expect(first?.score).toBe(0.45);
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
