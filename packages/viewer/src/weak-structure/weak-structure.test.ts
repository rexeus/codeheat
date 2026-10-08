import type { Analysis } from "@codeheat/engine";
import { describe, expect, it } from "vitest";

import { indexTerritories } from "../territories/territory-index.js";
import { reportWithParts } from "../testing/design-fit.js";
import { reportOf } from "../testing/reports.js";
import { weakStructureOf } from "./weak-structure.js";

const weakStructure = (report: Analysis) =>
  weakStructureOf(report, indexTerritories(report.territories));

describe("weakStructureOf", () => {
  const report = reportWithParts([
    {
      id: "t1",
      path: "packages/forms",
      heat: 0.2,
      containment: 0.9,
      standing: "holds",
    },
    {
      id: "t2",
      path: "packages/core",
      heat: 0.4,
      containment: 0.3,
      partner: { territory: "t3", sharedChanges: 12, share: 0.49 },
      standing: "leaks",
    },
    {
      id: "t3",
      path: "packages/compiler",
      heat: 0.25,
      containment: 0.75,
      standing: "leaks",
    },
    { id: "t4", path: "apps/docs", heat: 0.1, containment: 0.2, changes: 3 },
    { id: "t5", path: "apps/web", heat: 0.05, containment: 0.1, partner: null },
  ]);
  const result = weakStructure(report);

  it("counts the judged territories that leak, at the limit included, and the heat they hold", () => {
    expect(result).toMatchObject({ kind: "some", leaking: 2, limit: 0.75 });
    expect(result.kind === "some" ? result.leakShare : 0).toBeCloseTo(0.65);
  });

  it("lists the judged territories hottest first, with where each reaches most", () => {
    expect(result.kind === "some" ? result.rows : []).toEqual([
      {
        id: "t2",
        name: { dir: "packages/", base: "core" },
        heatShare: 0.4,
        containment: 0.3,
        leaks: true,
        partner: { name: "compiler", share: 0.49 },
      },
      expect.objectContaining({ id: "t3", leaks: true }),
      expect.objectContaining({ id: "t1", leaks: false }),
    ]);
  });

  it("counts the territories with too few changes or no partner as not judged", () => {
    expect(result).toMatchObject({ unjudged: 2 });
  });
});

describe("weakStructureOf without an answer", () => {
  it("says no territory has enough changes to judge", () => {
    const sparse = reportWithParts([
      { id: "t1", path: "a", heat: 0.7, containment: 0.6, changes: 4 },
      { id: "t2", path: "b", heat: 0.3, containment: null },
    ]);

    expect(weakStructure(sparse)).toEqual({
      kind: "none",
      note: "No territory has enough changes to judge: it takes 5 counted changes and a partner to leak to, and test code is not judged.",
    });
  });

  it("says only test code or leftover files changed when no territory is real", () => {
    const testsOnly = reportWithParts([
      { id: "t1", path: "test", heat: 1, containment: null, kind: "tests" },
    ]);

    expect(weakStructure(testsOnly)).toEqual({
      kind: "none",
      note: "No real territory: only test code or leftover files changed.",
    });
  });

  it("tells a report without territories to analyze again", () => {
    expect(weakStructure(reportOf([]))).toEqual({
      kind: "none",
      note: "This report has no territories; analyze again with a current codeheat.",
    });
  });
});
