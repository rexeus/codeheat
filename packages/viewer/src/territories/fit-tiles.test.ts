import { describe, expect, it } from "vitest";

import { entryViewsOf } from "../entry-points/entry-views.js";
import { boundaryOn, reportWithParts } from "../testing/design-fit.js";
import { territoryNode } from "../testing/reports.js";
import { fitTilesOf } from "./fit-tiles.js";
import { indexTerritories } from "./territory-index.js";

const tilesOf = (report: ReturnType<typeof reportWithParts>) => {
  const index = indexTerritories(report.territories);
  return fitTilesOf(index, entryViewsOf(report, index), report.thresholds);
};

const report = reportWithParts(
  [
    {
      id: "t1",
      path: "packages/core",
      heat: 0.36,
      containment: 0.35,
      kind: "package",
      description: "The core",
    },
    { id: "t2", path: "docs", heat: 0.04, containment: 0.9 },
    {
      id: "t3",
      path: "packages",
      heat: 0.0001,
      containment: null,
      kind: "other",
      description: "5 smaller folders in packages; main files: a, b",
    },
  ],
  {
    entryPoints: [
      boundaryOn(1, ["t1"]),
      boundaryOn(2, ["t2"]),
      boundaryOn(5, ["t1"]),
    ],
  },
);

describe("fitTilesOf", () => {
  it("makes one tile per territory at the recommended detail, in order", () => {
    expect(tilesOf(report).map(({ id }) => id)).toEqual(["t1", "t2", "t3"]);
  });

  it("sizes a tile by the square root of its heat share, with a floor", () => {
    const [core, docs, bucket] = tilesOf(report);

    expect(core?.weight).toBeCloseTo(0.6, 10);
    expect(docs?.weight).toBeCloseTo(0.2, 10);
    expect(bucket?.weight).toBe(0.07);
  });

  it("colors by containment on the cohesion steps, and no data as step 0", () => {
    expect(tilesOf(report).map(({ step }) => step)).toEqual([2, 6, 0]);
  });

  it("marks a territory with the ranks of every place to start that concerns it, best first", () => {
    expect(tilesOf(report).map(({ ranks }) => ranks)).toEqual([
      [1, 5],
      [2],
      [],
    ]);
  });

  it("marks the visible territory that holds a finer one an entry names", () => {
    const finer = reportWithParts(
      [{ id: "t1", path: "core", heat: 0.5, containment: 0.5 }],
      { entryPoints: [boundaryOn(1, ["t-inner"])] },
    );
    const withInner = {
      ...finer,
      territories: {
        ...finer.territories,
        nodes: [
          ...finer.territories.nodes,
          territoryNode("t-inner", "core/inner", { parent: "t1" }),
        ],
      },
    };

    expect(tilesOf(withInner).map(({ ranks }) => ranks)).toEqual([[1]]);
  });
});

describe("fitTilesOf labels", () => {
  it("splits a package or folder name into its folder and last segment", () => {
    expect(tilesOf(report).map(({ nameParts }) => nameParts)).toEqual([
      { dir: "packages/", base: "core" },
      { dir: "", base: "docs" },
      { dir: "", base: "5 smaller folders in packages" },
    ]);
  });

  it("describes a bucket by what is in it, since its name says what it is", () => {
    expect(tilesOf(report).map(({ description }) => description)).toEqual([
      "The core",
      "What docs is",
      "main files: a, b",
    ]);
  });

  it("puts every number a reader needs in the summary", () => {
    expect(tilesOf(report).map(({ summary }) => summary)).toEqual([
      "packages/core; 35% of its changes stay inside; 36% of the change effort; place to start #1, #5",
      "docs; 90% of its changes stay inside; 4% of the change effort; place to start #2",
      "5 smaller folders in packages; no counted changes in this window; <1% of the change effort",
    ]);
  });
});

describe("fitTilesOf judgement", () => {
  it("says why a tile is not judged, naming the real reason", () => {
    const quiet = reportWithParts([
      { id: "t1", path: "a", heat: 0, containment: null, changes: 0 },
      { id: "t2", path: "b", heat: 0.1, containment: null, kind: "tests" },
      { id: "t3", path: "c", heat: 0.1, containment: 0.5 },
      { id: "t4", path: "d", heat: 0.02, containment: null, changes: 0 },
      { id: "t5", path: "e", heat: 0.1, containment: 0, changes: 2 },
    ]);

    expect(tilesOf(quiet).map(({ noData }) => noData)).toEqual([
      "no counted changes in this window",
      "test code is not judged",
      null,
      "changed only in changes of more than 50 files, which are not judged",
      "too few changes to judge (2)",
    ]);
  });

  it("reads the size of an uncounted change from the report's thresholds", () => {
    const large = reportWithParts(
      [{ id: "t1", path: "a", heat: 0.02, containment: null, changes: 0 }],
      {},
    );
    const limited = {
      ...large,
      thresholds: { ...large.thresholds, maxCommitFiles: 80 },
    };

    expect(tilesOf(limited)[0]?.noData).toBe(
      "changed only in changes of more than 80 files, which are not judged",
    );
  });

  it("does not color a tile with too few changes by its containment, and says so in its summary", () => {
    const few = reportWithParts([
      { id: "t1", path: "code", heat: 0.1, containment: 0, changes: 2 },
      { id: "t2", path: "enough", heat: 0.1, containment: 0.2, changes: 5 },
    ]);

    const [small, enough] = tilesOf(few);

    expect(small).toMatchObject({ containment: null, step: 0 });
    expect(small?.summary).toBe(
      "code; too few changes to judge (2); 10% of the change effort",
    );
    expect(enough).toMatchObject({ containment: 0.2, step: 1, noData: null });
  });
});

describe("fitTilesOf groups", () => {
  it("splits a group into its shared folder and what tells its members apart", () => {
    const grouped = reportWithParts([
      {
        id: "t1",
        path: "packages/e/src/a + packages/e/src/b",
        heat: 0.1,
        containment: 0.5,
        kind: "group",
      },
      {
        id: "t2",
        path: "x/a + y/b",
        heat: 0.1,
        containment: 0.5,
        kind: "group",
      },
    ]);

    expect(tilesOf(grouped).map(({ nameParts }) => nameParts)).toEqual([
      { dir: "packages/e/src/", base: "a + b" },
      { dir: "", base: "x/a + y/b" },
    ]);
  });

  it("has no tiles without territories", () => {
    expect(tilesOf(reportWithParts([]))).toEqual([]);
  });
});
