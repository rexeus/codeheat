import type { Analysis } from "@codeheat/engine";
import { describe, expect, it } from "vitest";

import { fileTerritoryLine, territoryLines } from "./territory-view.js";

type Territories = Analysis["territories"];

const node = (id: string, kind: Territories["nodes"][number]["kind"]) => ({
  id,
  path: id,
  kind,
  parent: null,
  children: [],
  files: 3,
  changes: 1,
  heatShare: 0,
  description: id,
  splitReason: null,
  fit: null,
});

describe("territoryLines", () => {
  it("counts the areas at the recommended detail: loose files from 1% of the heat, no buckets", () => {
    const territories: Territories = {
      recommended: 2,
      details: [
        { level: 1, ids: ["a"] },
        { level: 2, ids: ["b", "c", "d", "e", "f"] },
        { level: 3, ids: ["b", "c", "d", "e", "g", "h"] },
      ],
      nodes: [
        node("a", "folder"),
        node("b", "package"),
        node("c", "group"),
        { ...node("d", "files"), heatShare: 0.02 },
        { ...node("e", "files"), heatShare: 0.005 },
        node("f", "folder"),
        node("g", "folder"),
        node("h", "folder"),
      ],
    };

    expect(territoryLines({ territories })).toStrictEqual([
      "Areas: 4 at the recommended detail (2 of 3); --json has every detail.",
    ]);
  });

  it("says nothing without territories", () => {
    expect(
      territoryLines({
        territories: { recommended: 0, details: [], nodes: [] },
      }),
    ).toStrictEqual([]);
  });
});

const fit = {
  detail: 1,
  containment: 0.4615,
  radius: 2,
  partner: { territory: "b", sharedChanges: 6, share: 0.4615 },
  distantPairs: 0,
  hiddenPairs: 0,
  cliques: 0,
  erosion: null,
  chronicFiles: 0,
  acuteFiles: 0,
  chronicShare: 0,
  fixDensity: null,
};
const nodes = [
  { ...node("a", "folder"), path: "billing", changes: 13, fit },
  { ...node("b", "folder"), path: "web" },
  {
    ...node("c", "folder"),
    path: "quiet\u001B[0m",
    changes: 0,
    fit: { ...fit, containment: null, partner: null },
  },
];

describe("fileTerritoryLine", () => {
  it("says how many changes of the territory stay inside and which territory it changes with most", () => {
    expect(fileTerritoryLine(nodes, "a")).toStrictEqual([
      "territory billing: 46% of 13 changes stay inside, most often with web (6)",
    ]);
  });

  it("says when the territory has no counted changes, with its path made safe to print", () => {
    expect(fileTerritoryLine(nodes, "c")).toStrictEqual([
      "territory quiet\\u001b[0m: no counted changes",
    ]);
  });
});

describe("fileTerritoryLine without a line to show", () => {
  it("says that nothing was counted for a territory no change touched", () => {
    expect(
      fileTerritoryLine([{ ...node("t", "folder"), changes: 0 }], "t"),
    ).toStrictEqual(["territory t: no counted changes"]);
  });

  it("says nothing for a territory that is not listed", () => {
    expect(fileTerritoryLine(nodes, "z")).toStrictEqual([]);
  });
});
