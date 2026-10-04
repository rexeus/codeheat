import { describe, expect, it } from "vitest";

import { indexTerritories } from "../territories/territory-index.js";
import { territoryFit, territoryNode } from "../testing/reports.js";
import { matrixOf } from "./matrix-data.js";
import { cellSummary } from "./matrix-summary.js";

const LIMITS = { minSharedCommits: 3 };

const index = indexTerritories({
  recommended: 1,
  details: [{ level: 1, ids: ["a", "b", "c", "d"] }],
  nodes: [
    territoryNode("root", ".", { fit: null }),
    territoryNode("a", "core", { parent: "root", heatShare: 0.4 }),
    territoryNode("b", "web", { parent: "root", heatShare: 0.3 }),
    territoryNode("c", "auth", { parent: "root", heatShare: 0.2 }),
    territoryNode("d", "docs", {
      parent: "root",
      heatShare: 0.1,
      fit: territoryFit({ containment: null }),
    }),
  ],
});

const pair = (a: string, b: string, distant: number, hidden: number) => ({
  a,
  b,
  sharedChanges: 12,
  distantPairs: distant,
  hiddenPairs: hidden,
});

const matrix = matrixOf(
  index,
  [pair("a", "b", 3, 3), pair("a", "c", 3, 1), pair("b", "c", 2, 0)],
  { maxCommitFiles: 50, minModuleCommits: 5, maxCoupledTerritories: 24 },
);

const say = (row: number, column: number) =>
  cellSummary(matrix, row, column, LIMITS);

describe("cellSummary", () => {
  it("says that two territories changed together and that no import links them", () => {
    expect(say(0, 1)).toBe(
      "core and web changed together 12 times; no import between them (3 coupled file pairs).",
    );
  });

  it("counts the pairs without an import when only some lack one", () => {
    expect(say(0, 2)).toBe(
      "core and auth changed together 12 times; no import between 1 of 3 coupled file pairs.",
    );
  });

  it("does not claim an import where the relation may be unknown", () => {
    expect(say(1, 2)).toBe(
      "web and auth changed together 12 times; 2 coupled file pairs between them, each linked by an import or not readable.",
    );
  });

  it("reads the same from both sides", () => {
    expect(say(2, 0)).toBe(
      "auth and core changed together 12 times; no import between 1 of 3 coupled file pairs.",
    );
  });

  it("says how much of a territory's changes stay inside it", () => {
    expect(say(0, 0)).toBe("core: 60% of its 20 changes stay inside it.");
    expect(say(3, 3)).toBe(
      "docs is not judged: no counted changes in this window.",
    );
  });

  it("says that a pair the report does not list shared too few changes", () => {
    expect(say(1, 3)).toBe("web and docs shared fewer than 3 changes.");
  });
});
