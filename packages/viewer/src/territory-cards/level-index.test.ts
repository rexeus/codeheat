import { describe, expect, it } from "vitest";

import { fileStats } from "../testing/reports.js";
import { territoryTreeReport } from "../testing/territory-tree.js";
import { levelChoicesOf } from "./detail-levels.js";
import { codeFirst, indexLevel } from "./level-index.js";

const report = territoryTreeReport();
const at = (level: number) =>
  indexLevel(report.territories, report.files, level);

describe("indexLevel", () => {
  it("lists the territories of a detail in the report's order", () => {
    expect(at(1).territories.map(({ id }) => id)).toEqual(["t2", "t5", "t6"]);
    expect(at(2).territories.map(({ id }) => id)).toEqual([
      "t3",
      "t4",
      "t5",
      "t6",
    ]);
  });

  it("finds the territory that holds a node of the tree, at the detail shown", () => {
    expect(at(1).ownerOf("t3")).toBe("t2");
    expect(at(1).ownerOf("t2")).toBe("t2");
    expect(at(2).ownerOf("t3")).toBe("t3");
    expect(at(2).ownerOf("t5")).toBe("t5");
  });

  it("knows no owner for a node above the detail or an unknown one", () => {
    expect(at(2).ownerOf("t2")).toBeUndefined();
    expect(at(2).ownerOf("t99")).toBeUndefined();
  });

  it("gives each territory the files of everything it holds, hottest first", () => {
    expect(
      at(1)
        .filesOf("t2")
        .map(({ path }) => path),
    ).toEqual(["core/src/a.test.ts", "core/src/a.ts", "core/rest/b.ts"]);
    expect(
      at(2)
        .filesOf("t4")
        .map(({ path }) => path),
    ).toEqual(["core/rest/b.ts"]);
    expect(at(2).filesOf("t2")).toEqual([]);
  });

  it("is empty for a detail the report does not have", () => {
    expect(at(9).territories).toEqual([]);
    expect(at(9).ownerOf("t3")).toBeUndefined();
  });
});

describe("codeFirst", () => {
  it("leaves out test code while there is code", () => {
    const files = [fileStats("a.test.ts", { test: true }), fileStats("a.ts")];

    expect(codeFirst(files).map(({ path }) => path)).toEqual(["a.ts"]);
  });

  it("keeps test code when it is all there is", () => {
    const files = [fileStats("a.test.ts", { test: true })];

    expect(codeFirst(files)).toEqual(files);
  });
});

describe("levelChoicesOf", () => {
  it("lists the report's levels coarsest first with their real territories and the recommended one", () => {
    expect(levelChoicesOf(report.territories)).toEqual([
      { level: 1, territories: 2, recommended: false },
      { level: 2, territories: 3, recommended: true },
    ]);
  });

  it("has no choices without details", () => {
    expect(levelChoicesOf({ recommended: 0, details: [], nodes: [] })).toEqual(
      [],
    );
  });
});
