import { describe, expect, it } from "vitest";

import { boundaryOn, reportWithParts } from "../testing/design-fit.js";
import { reportOf } from "../testing/reports.js";
import { heroDataOf } from "./hero-data.js";

describe("heroDataOf", () => {
  const report = reportWithParts(
    [
      { id: "t1", path: "packages/core", heat: 0.6, containment: 0.3 },
      { id: "t2", path: "packages/forms", heat: 0.4, containment: 0.9 },
    ],
    { entryPoints: [boundaryOn(1, ["t1"])] },
  );

  it("derives the verdict, the fit map, and the places to start from one report", () => {
    const hero = heroDataOf(report);

    expect(hero.verdict.level).toBe("strained");
    expect(hero.tiles.map(({ id, ranks }) => ({ id, ranks }))).toEqual([
      { id: "t1", ranks: [1] },
      { id: "t2", ranks: [] },
    ]);
    expect(
      hero.entries.map(({ rank, heading }) => ({ rank, heading })),
    ).toEqual([{ rank: 1, heading: ["packages/core"] }]);
  });

  it("still answers for a report without territories or entry points", () => {
    const hero = heroDataOf(reportOf([]));

    expect(hero.tiles).toEqual([]);
    expect(hero.entries).toEqual([]);
    expect(hero.verdict.level).toBe("unknown");
    expect(hero.noEntries).toBe(
      "This report has no territories or entry points; analyze again with a current codeheat to see where to start.",
    );
  });
});
