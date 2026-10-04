import type { Report } from "@codeheat/engine";
import { describe, expect, it } from "vitest";

import { boundaryOn } from "../testing/design-fit.js";
import { entryPointOf } from "../testing/reports.js";
import { cardAt } from "../testing/territory-cards.js";
import { territoryTreeReport } from "../testing/territory-tree.js";

const report = territoryTreeReport();
const card = cardAt;
const withEntries = (...entryPoints: Report["entryPoints"]): Report => ({
  ...report,
  entryPoints,
});
const ranksOn = (r: Report, level: number, id: string): number[] =>
  card(r, level, id).findings.flatMap(({ rank }) =>
    rank === null ? [] : [rank],
  );

describe("a place to start on the card of its territory", () => {
  it("gives a place to start to the card of its territory", () => {
    const withEntry = withEntries(boundaryOn(1, ["t3"]));

    expect(card(withEntry, 2, "t3").findings[0]).toMatchObject({
      label: "Boundary",
      rank: 1,
      where: "",
    });
    expect(ranksOn(withEntry, 2, "t4")).not.toContain(1);
  });

  it("gives it to the coarser card that holds the territory, and says which part", () => {
    const withEntry = withEntries(boundaryOn(1, ["t3"]));

    expect(card(withEntry, 1, "t2").findings[0]).toMatchObject({
      label: "Boundary",
      rank: 1,
      where: "in src",
    });
  });

  it("keeps a place to start on its territory at a detail finer than the recommended one", () => {
    // With detail 1 recommended, the entry's territory is lifted to t2 for the
    // page, but the card of t3 at detail 2 is still the one it is about.
    const coarse: Report = {
      ...withEntries(boundaryOn(1, ["t3"])),
      territories: { ...report.territories, recommended: 1 },
    };

    expect(card(coarse, 2, "t3").findings[0]).toMatchObject({
      rank: 1,
      where: "",
    });
    expect(ranksOn(coarse, 2, "t4")).toEqual([]);
  });
});

describe("a place to start on a card at another detail", () => {
  it("gives a place to start about a territory to the finer cards inside it, and says it is about the whole", () => {
    const whole = withEntries(boundaryOn(1, ["t2"]));

    expect(card(whole, 2, "t3").findings[0]).toMatchObject({
      rank: 1,
      where: "within core",
    });
    expect(card(whole, 2, "t4").findings[0]).toMatchObject({
      rank: 1,
      where: "within core",
    });
    expect(ranksOn(whole, 2, "t5")).toEqual([]);
    expect(card(whole, 1, "t2").findings[0]).toMatchObject({
      rank: 1,
      where: "",
    });
  });

  it("names every part when a place to start concerns several parts of a card", () => {
    const clique = withEntries(
      entryPointOf(1, {
        kind: "clique",
        territories: ["t3", "t4"],
        verdict: "These territories change as one.",
      }),
    );

    expect(card(clique, 1, "t2").findings[0]).toMatchObject({
      rank: 1,
      where: "in src, rest",
    });
    expect(card(clique, 2, "t3").findings[0]).toMatchObject({
      rank: 1,
      where: "",
    });
    expect(card(clique, 2, "t4").findings[0]).toMatchObject({
      rank: 1,
      where: "",
    });
  });
});

describe("a place to start that concerns several parts, or only files", () => {
  it("finds the territory of a file the place to start names", () => {
    const hub = withEntries(
      entryPointOf(1, {
        kind: "hub",
        territories: [],
        files: ["core/rest/b.ts"],
      }),
    );

    expect(ranksOn(hub, 2, "t4")).toEqual([1]);
    expect(ranksOn(hub, 2, "t3")).toEqual([]);
    expect(card(hub, 1, "t2").findings[0]).toMatchObject({
      rank: 1,
      where: "in rest",
    });
  });
});
