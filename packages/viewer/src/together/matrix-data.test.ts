import { describe, expect, it } from "vitest";

import { indexTerritories } from "../territories/territory-index.js";
import { territoryFit, territoryNode } from "../testing/reports.js";
import { matrixOf } from "./matrix-data.js";

const LIMITS = {
  maxCommitFiles: 50,
  minModuleCommits: 5,
  maxCoupledTerritories: 24,
};

type Spec = { id: string; heat: number; kind?: "folder" | "other" | "tests" };

const indexOf = (specs: readonly Spec[]) =>
  indexTerritories({
    recommended: 1,
    details: [{ level: 1, ids: specs.map(({ id }) => id) }],
    nodes: [
      territoryNode("root", ".", { fit: null }),
      ...specs.map(({ id, heat, kind }) =>
        territoryNode(id, `src/${id}`, {
          parent: "root",
          heatShare: heat,
          kind: kind ?? "folder",
        }),
      ),
    ],
  });

const pair = (a: string, b: string, sharedChanges: number, hidden = 0) => ({
  a,
  b,
  sharedChanges,
  distantPairs: 2,
  hiddenPairs: hidden,
});

describe("matrixOf", () => {
  const index = indexOf([
    { id: "t1", heat: 0.2 },
    { id: "t2", heat: 0.5 },
    { id: "t3", heat: 0.3 },
  ]);

  it("has a row for each territory, the hottest first", () => {
    expect(matrixOf(index, [], LIMITS).rows.map(({ id }) => id)).toStrictEqual([
      "t2",
      "t3",
      "t1",
    ]);
  });

  it("reads a pair the same from both sides, and the diagonal as no pair", () => {
    const matrix = matrixOf(index, [pair("t1", "t2", 8, 1)], LIMITS);

    expect(matrix.cellAt(0, 2)).toStrictEqual(matrix.cellAt(2, 0));
    expect(matrix.cellAt(0, 2)).toMatchObject({
      sharedChanges: 8,
      distantPairs: 2,
      hiddenPairs: 1,
    });
    expect(matrix.cellAt(0, 0)).toBeNull();
    expect(matrix.cellAt(0, 1)).toBeNull();
  });

  it("colors on a log scale against the strongest pair", () => {
    const matrix = matrixOf(
      index,
      [pair("t1", "t2", 100), pair("t2", "t3", 10), pair("t1", "t3", 3)],
      LIMITS,
    );

    expect(matrix.maxShared).toBe(100);
    expect(matrix.cellAt(0, 2)?.level).toBe(5);
    expect(matrix.cellAt(0, 1)?.level).toBe(3);
    expect(matrix.cellAt(1, 2)?.level).toBe(2);
  });

  it("leaves out buckets and test code, and a pair that names a territory it does not show", () => {
    const matrix = matrixOf(
      indexOf([
        { id: "t1", heat: 0.2 },
        { id: "o1", heat: 0.5, kind: "other" },
        { id: "x1", heat: 0.1, kind: "tests" },
      ]),
      [pair("o1", "t1", 9), pair("t1", "zz", 9)],
      LIMITS,
    );

    expect(matrix.rows.map(({ id }) => id)).toStrictEqual(["t1"]);
    expect(matrix.total).toBe(1);
    expect(matrix.maxShared).toBe(0);
  });
});

describe("matrixOf with many territories", () => {
  const specs = Array.from({ length: 27 }, (_, number) => ({
    id: `t${String(number).padStart(2, "0")}`,
    heat: 0.04 - number * 0.001,
  }));
  const matrix = matrixOf(
    indexOf(specs),
    [pair("t00", "t01", 7), pair("t00", "t26", 9)],
    LIMITS,
  );

  it("covers the hottest 24 and says how many there are", () => {
    expect(matrix.rows).toHaveLength(24);
    expect(matrix.rows.at(-1)?.id).toBe("t23");
    expect(matrix.total).toBe(27);
  });

  it("does not draw a pair with a territory beyond the cap", () => {
    expect(matrix.cellAt(0, 1)?.sharedChanges).toBe(7);
    expect(matrix.maxShared).toBe(7);
  });

  it("breaks a tie in heat by id", () => {
    const tied = matrixOf(
      indexOf(specs.map(({ id }) => ({ id, heat: 0.03 }))),
      [],
      LIMITS,
    );

    expect(tied.rows.map(({ id }) => id)).toStrictEqual(
      specs.slice(0, 24).map(({ id }) => id),
    );
  });
});

describe("matrixOf diagonal", () => {
  it("carries the containment of a judged territory and why another is not", () => {
    const matrix = matrixOf(
      indexTerritories({
        recommended: 1,
        details: [{ level: 1, ids: ["a", "b", "c"] }],
        nodes: [
          territoryNode("root", ".", { fit: null }),
          territoryNode("a", "a", {
            parent: "root",
            heatShare: 0.6,
            changes: 20,
          }),
          territoryNode("b", "b", {
            parent: "root",
            heatShare: 0.3,
            changes: 20,
            fit: territoryFit({ containment: null }),
          }),
          territoryNode("c", "c", {
            parent: "root",
            heatShare: 0.1,
            changes: 2,
          }),
        ],
      }),
      [],
      LIMITS,
    );

    expect(matrix.rows[0]).toMatchObject({ containment: 0.6, step: 4 });
    expect(matrix.rows[1]).toMatchObject({
      containment: null,
      noData: "no counted changes in this window",
      step: 0,
    });
    expect(matrix.notCompared[0]).toMatchObject({
      noData: "too few changes to judge (2)",
    });
  });
});

describe("matrixOf cap and ranking", () => {
  const nodes = [
    territoryNode("root", ".", { fit: null }),
    territoryNode("a", "core", { parent: "root", heatShare: 0.4, changes: 30 }),
    territoryNode("b", "web", { parent: "root", heatShare: 0.3, changes: 3 }),
    territoryNode("c", "auth", { parent: "root", heatShare: 0.2, changes: 12 }),
    territoryNode("d", "docs", { parent: "root", heatShare: 0.1, changes: 20 }),
  ];
  const index = indexTerritories({
    recommended: 1,
    details: [{ level: 1, ids: ["a", "b", "c", "d"] }],
    nodes,
  });

  it("reads the cap from the report's limit instead of its own", () => {
    const matrix = matrixOf(index, [], { ...LIMITS, maxCoupledTerritories: 3 });

    expect(matrix.considered).toBe(3);
    expect(matrix.total).toBe(4);
    expect(matrix.rows.map(({ id }) => id)).toStrictEqual(["a", "c"]);
  });

  it("ranks only territories with enough changes and names the others apart", () => {
    const matrix = matrixOf(index, [], LIMITS);

    expect(matrix.rows.map(({ id }) => id)).toStrictEqual(["a", "c", "d"]);
    expect(matrix.notCompared.map(({ name }) => name)).toStrictEqual(["web"]);
    expect(matrix.considered).toBe(4);
  });

  it("labels two rows that share a name with the folder that tells them apart", () => {
    const twins = indexTerritories({
      recommended: 1,
      details: [{ level: 1, ids: ["a", "b"] }],
      nodes: [
        territoryNode("root", ".", { fit: null }),
        territoryNode("a", "scripts", { parent: "root", heatShare: 0.5 }),
        territoryNode("b", "adev/scripts", { parent: "root", heatShare: 0.4 }),
      ],
    });

    expect(
      matrixOf(twins, [], LIMITS).rows.map(({ nameParts }) => nameParts),
    ).toStrictEqual([
      { dir: "", base: "scripts" },
      { dir: "", base: "adev/scripts" },
    ]);
  });

  it("draws no cell for a pair with a territory that is not compared", () => {
    const matrix = matrixOf(
      index,
      [pair("a", "b", 9), pair("a", "c", 6)],
      LIMITS,
    );

    expect(matrix.maxShared).toBe(6);
    expect(matrix.cellAt(0, 1)?.sharedChanges).toBe(6);
  });
});
