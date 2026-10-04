import type { Report } from "@codeheat/engine";
import { describe, expect, it } from "vitest";

import { reportWithParts } from "../testing/design-fit.js";
import { cardAt, cardsAt } from "../testing/territory-cards.js";
import { territoryTreeReport } from "../testing/territory-tree.js";

const card = cardAt;

const report = territoryTreeReport();

describe("cardsOf with two territories of one name", () => {
  it("names the folder that tells their cards apart", () => {
    const twins = reportWithParts([
      { id: "t1", path: "scripts", heat: 0.2, containment: 0.5 },
      { id: "t2", path: "adev/scripts", heat: 0.1, containment: 0.5 },
    ]);

    expect(cardsAt(twins, 1).map(({ nameParts }) => nameParts)).toEqual([
      { dir: "", base: "scripts" },
      { dir: "", base: "adev/scripts" },
    ]);
  });
});

describe("cardsOf at the recommended detail", () => {
  it("makes one card per territory in the report's order", () => {
    expect(cardsAt(report, 2).map(({ territory }) => territory.id)).toEqual([
      "t3",
      "t4",
      "t5",
      "t6",
    ]);
  });

  it("says how hot a territory is and how many of its changes stay inside", () => {
    expect(card(report, 2, "t3")).toMatchObject({
      name: "core/src",
      heatShare: 0.4,
      containment: 0.3,
      noData: null,
      step: 2,
      quiet: false,
    });
  });

  it("says why a territory is not judged, and keeps test code quiet", () => {
    expect(card(report, 2, "t6")).toMatchObject({
      containment: null,
      noData: "test code is not judged",
      step: 0,
      quiet: true,
    });
  });

  it("names the hottest file of the code, and of the tests when there is no other", () => {
    expect(card(report, 2, "t3").hottest?.path).toBe("core/src/a.ts");
    expect(card(report, 2, "t6").hottest?.path).toBe("core/c.test.ts");
  });

  it("names the territory it changes with most and how often", () => {
    expect(card(report, 2, "t3").partner).toEqual({
      name: "core/rest",
      sharedChanges: 9,
      ofChanges: 30,
    });
    expect(card(report, 2, "t4").partner).toBeNull();
  });

  it("links a territory to its own tile on the fit map", () => {
    expect(card(report, 2, "t3").fitLink).toEqual({
      territory: "t3",
      exact: true,
      name: "core/src",
    });
  });
});

describe("cardsOf for territories that are not judged", () => {
  it("names no hottest file when even the hottest has no heat", () => {
    const quiet = reportWithParts([
      { id: "t1", path: "build", heat: 0, containment: null },
    ]);
    const cold: Report = {
      ...quiet,
      files: quiet.files.map((file) => ({ ...file, score: 0 })),
    };

    expect(cardAt(cold, 1, "t1").hottest).toBeNull();
    expect(cardAt(quiet, 1, "t1").hottest?.path).toBe("build/index.ts");
  });

  it("keeps the face of a territory that is not judged compact", () => {
    expect(card(report, 2, "t3").compact).toBe(false);
    expect(card(report, 2, "t6").compact).toBe(true);
  });
});

describe("cardsOf at another detail", () => {
  it("shows the coarser territories with the files of everything inside", () => {
    expect(cardsAt(report, 1).map(({ territory }) => territory.id)).toEqual([
      "t2",
      "t5",
      "t6",
    ]);
    expect(card(report, 1, "t2").hottest?.path).toBe("core/src/a.ts");
  });

  it("offers no link to a territory the fit map shows only in parts", () => {
    expect(card(report, 1, "t2").fitLink).toBeNull();
  });

  it("links a finer territory to the tile that contains it", () => {
    const coarseMap: Report = {
      ...report,
      territories: { ...report.territories, recommended: 1 },
    };

    expect(card(coarseMap, 2, "t3").fitLink).toEqual({
      territory: "t2",
      exact: false,
      name: "core",
    });
  });
});
