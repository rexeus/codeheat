import type { Report } from "@codeheat/engine";
import { describe, expect, it } from "vitest";

import { indexTerritories } from "../territories/territory-index.js";
import { reportWithParts } from "../testing/design-fit.js";
import { reportOf } from "../testing/reports.js";
import { coChangeOf } from "./pairs.js";

const coChange = (report: Report) =>
  coChangeOf(report, indexTerritories(report.territories));

const parts = reportWithParts([
  { id: "t1", path: "packages/core", heat: 0.4, containment: 0.36 },
  { id: "t2", path: "packages/compiler", heat: 0.3, containment: 0.35 },
  { id: "t3", path: "packages/forms", heat: 0.2, containment: 0.8 },
  { id: "t4", path: "apps/scripts", heat: 0.05, containment: 0.7 },
  { id: "t5", path: "tools/scripts", heat: 0.05, containment: 0.7 },
]);

const pair = (
  a: string,
  b: string,
  sharedChanges: number,
  hiddenPairs = 0,
): Report["territoryCoupling"][number] => ({
  a,
  b,
  sharedChanges,
  distantPairs: hiddenPairs + 2,
  hiddenPairs,
});

describe("coChangeOf", () => {
  const report = {
    ...parts,
    territoryCoupling: [
      pair("t1", "t3", 38),
      pair("t1", "t2", 135, 10),
      pair("t2", "t3", 38, 1),
      pair("t4", "t5", 12),
    ],
  };
  const result = coChange(report);

  it("lists the pairs strongest first, by shared changes and then by hidden pairs", () => {
    expect(
      result.kind === "some"
        ? result.pairs.map(({ a, b, sharedChanges }) => [
            a.name.base,
            b.name.base,
            sharedChanges,
          ])
        : [],
    ).toEqual([
      ["core", "compiler", 135],
      ["compiler", "forms", 38],
      ["core", "forms", 38],
      ["apps/scripts", "tools/scripts", 12],
    ]);
  });

  it("puts the hotter territory of a pair first, with how much of its change stays inside", () => {
    const [strongest] = result.kind === "some" ? result.pairs : [];

    expect(strongest).toMatchObject({
      a: { id: "t1", containment: 0.36 },
      b: { id: "t2", containment: 0.35 },
      filePairs: 12,
      hiddenPairs: 10,
    });
  });

  it("counts the file pairs with no import over all the pairs", () => {
    expect(result).toMatchObject({ kind: "some", hiddenPairs: 11 });
  });

  it("leaves out a pair whose territory the report does not know", () => {
    const unknown = coChange({
      ...parts,
      territoryCoupling: [pair("t1", "t-gone", 50), pair("t2", "t3", 5)],
    });

    expect(unknown.kind === "some" ? unknown.pairs.length : 0).toBe(1);
  });
});

describe("coChangeOf without an answer", () => {
  it("says no two territories share enough changes", () => {
    expect(coChange(parts)).toEqual({
      kind: "none",
      note: "No two territories changed together in 3 or more changes.",
    });
  });

  it("tells a report without territories to analyze again", () => {
    expect(coChange(reportOf([]))).toEqual({
      kind: "none",
      note: "This report has no territories; analyze again with a current codeheat.",
    });
  });
});
