import type { Report } from "@codeheat/engine";
import { describe, expect, it } from "vitest";

import { entryViewsOf } from "../entry-points/entry-views.js";
import { indexTerritories } from "../territories/territory-index.js";
import { boundaryOn } from "../testing/design-fit.js";
import { territoryTreeReport } from "../testing/territory-tree.js";
import { cardSourceOf, cardsOf } from "./card-model.js";
import { indexLevel } from "./level-index.js";

const cardsAt = (report: Report, level: number) => {
  const territories = indexTerritories(report.territories);
  const source = cardSourceOf(
    report,
    territories,
    entryViewsOf(report, territories),
  );
  return cardsOf(source, indexLevel(report.territories, report.files, level));
};

const card = (report: Report, level: number, id: string) => {
  const found = cardsAt(report, level).find(
    ({ territory }) => territory.id === id,
  );
  if (found === undefined) {
    throw new Error(`no card ${id} at detail ${level}`);
  }
  return found;
};

const report = territoryTreeReport();

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

describe("cardsOf with places to start", () => {
  const withEntry: Report = {
    ...report,
    entryPoints: [boundaryOn(1, ["t3"])],
  };

  it("gives a place to start to the card of its territory", () => {
    expect(card(withEntry, 2, "t3").findings[0]).toMatchObject({
      label: "Boundary",
      rank: 1,
      where: "",
    });
    expect(
      card(withEntry, 2, "t4").findings.map(({ rank }) => rank),
    ).not.toContain(1);
  });

  it("gives it to the coarser card that holds the territory, and says which part", () => {
    expect(card(withEntry, 1, "t2").findings[0]).toMatchObject({
      label: "Boundary",
      rank: 1,
      where: "core/src",
    });
  });
});
