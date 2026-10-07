import type { Analysis } from "@codeheat/engine";
import { describe, expect, it } from "vitest";

import { indexTerritories } from "../territories/territory-index.js";
import { reportWithParts } from "../testing/design-fit.js";
import type { PartSpec } from "../testing/design-fit.js";
import { reportOf } from "../testing/reports.js";
import { concentrationOf } from "./concentration.js";

const concentration = (report: Analysis) =>
  concentrationOf(report, indexTerritories(report.territories));

/** Five territories: core leaks, web and forms hold, docs has too few changes, and test code. */
const PARTS: PartSpec[] = [
  {
    id: "t1",
    path: "packages/forms",
    heat: 0.1,
    containment: 0.9,
    standing: "holds",
  },
  {
    id: "t2",
    path: "packages/core",
    heat: 0.4,
    containment: 0.3,
    standing: "leaks",
  },
  {
    id: "t3",
    path: "apps/web",
    heat: 0.2,
    containment: 0.8,
    standing: "holds",
  },
  { id: "t4", path: "apps/docs", heat: 0.15, containment: 0.5, changes: 2 },
  { id: "t5", path: "test", heat: 0.15, containment: null, kind: "tests" },
];

describe("concentrationOf", () => {
  const report = reportWithParts(PARTS);
  const result = concentration(report);

  it("sums the heat of the three hottest territories out of the real ones", () => {
    expect(result).toMatchObject({ kind: "some", top: 3 });
    // core 40 % + web 20 % + docs 15 %; the test code is no territory
    expect(result.kind === "some" ? result.topShare : 0).toBeCloseTo(0.75);
  });

  it("lists every real territory hottest first, with how it holds up", () => {
    expect(
      result.kind === "some"
        ? result.rows.map(({ name, heatShare, standing }) => [
            name.base,
            heatShare,
            standing.kind === "unjudged" ? standing.reason : standing.kind,
          ])
        : [],
    ).toEqual([
      ["core", 0.4, "leaks"],
      ["web", 0.2, "holds"],
      ["docs", 0.15, "too few changes"],
      ["forms", 0.1, "holds"],
    ]);
  });

  it("counts test code in the total but not as a territory", () => {
    expect(result.kind === "some" ? result.elsewhere : 0).toBeCloseTo(0.15);
  });

  it("sums all the territories when there are fewer than three", () => {
    const two = concentration(
      reportWithParts([
        { id: "t1", path: "a", heat: 0.7, containment: 0.5 },
        { id: "t2", path: "b", heat: 0.3, containment: 0.5 },
      ]),
    );

    expect(two).toMatchObject({ kind: "some", top: 2, topShare: 1 });
  });
});

describe("concentrationOf without an answer", () => {
  it("tells a report without territories to analyze again", () => {
    expect(concentration(reportOf([]))).toEqual({
      kind: "none",
      note: "This report has no territories; analyze again with a current codeheat.",
    });
  });

  it("says only test code or leftover files changed when no territory is real", () => {
    const testsOnly = reportWithParts([
      { id: "t1", path: "test", heat: 0.7, containment: null, kind: "tests" },
      { id: "t2", path: ".", heat: 0.3, containment: 0.5, kind: "other" },
    ]);

    expect(concentration(testsOnly)).toEqual({
      kind: "none",
      note: "No real territory: only test code or leftover files changed.",
    });
  });

  it("says nothing changed when no territory holds heat", () => {
    const quiet = reportWithParts([
      { id: "t1", path: "a", heat: 0, containment: null },
      { id: "t2", path: "b", heat: 0, containment: null },
    ]);

    expect(concentration(quiet)).toEqual({
      kind: "none",
      note: "Nothing changed in this window, so change concentrates nowhere.",
    });
  });
});
