import { describe, expect, it } from "vitest";

import { territoryNode } from "../testing/reports.js";
import { indexTerritories, territoryName } from "./territory-index.js";

// root > core > (core/src, core/rest); the recommended detail shows core/src, core/rest, and docs.
const nodes = [
  territoryNode("t1", ".", { children: ["t2", "t5"], fit: null }),
  territoryNode("t2", "core", { parent: "t1", children: ["t3", "t4"] }),
  territoryNode("t3", "core/src", { parent: "t2" }),
  territoryNode("t4", "core/rest", { parent: "t2" }),
  territoryNode("t5", "docs", { parent: "t1" }),
];

const index = indexTerritories({
  recommended: 2,
  details: [
    { level: 1, ids: ["t2", "t5"] },
    { level: 2, ids: ["t3", "t4", "t5"] },
  ],
  nodes,
});

describe("indexTerritories", () => {
  it("lists the territories at the recommended detail in the report's order", () => {
    expect(index.recommended.map(({ id }) => id)).toEqual(["t3", "t4", "t5"]);
  });

  it("finds a visible territory as itself and a hidden one by its nearest visible ancestor", () => {
    expect(index.visibleOf("t3")?.id).toBe("t3");
    expect(index.visibleOf("t2")).toBeUndefined();
    expect(index.visibleOf("t1")).toBeUndefined();
  });

  it("walks up from a territory that only a finer detail shows", () => {
    const coarse = indexTerritories({
      recommended: 1,
      details: [
        { level: 1, ids: ["t2", "t5"] },
        { level: 2, ids: ["t3", "t4", "t5"] },
      ],
      nodes,
    });

    expect(coarse.visibleOf("t3")?.id).toBe("t2");
    expect(coarse.visibleOf("t4")?.id).toBe("t2");
    expect(coarse.visibleOf("t5")?.id).toBe("t5");
  });

  it("knows no territory it was not given", () => {
    expect(index.visibleOf("t99")).toBeUndefined();
  });

  it("has no territories without a detail", () => {
    const empty = indexTerritories({ recommended: 0, details: [], nodes: [] });

    expect(empty.recommended).toEqual([]);
    expect(empty.visibleOf("t1")).toBeUndefined();
  });
});

describe("territoryName", () => {
  it("is the path of a package, folder, or group", () => {
    expect(
      territoryName(territoryNode("a", "packages/core", { kind: "package" })),
    ).toBe("packages/core");
    expect(
      territoryName(territoryNode("b", "a/x + b/y", { kind: "group" })),
    ).toBe("a/x + b/y");
    expect(territoryName(territoryNode("c", "src"))).toBe("src");
  });

  it("names the folder a group shares once", () => {
    expect(
      territoryName(
        territoryNode("a", "p/x/a + p/x/b + p/x/c", { kind: "group" }),
      ),
    ).toBe("p/x/a + b + c");
  });

  it("says what test code and a bucket are", () => {
    expect(
      territoryName(territoryNode("a", "apps/cli", { kind: "tests" })),
    ).toBe("tests in apps/cli");
    expect(
      territoryName(
        territoryNode("b", "packages", {
          kind: "other",
          description: "13 smaller folders in packages; main files: a, b",
        }),
      ),
    ).toBe("13 smaller folders in packages");
    expect(
      territoryName(
        territoryNode("c", "adev", {
          kind: "other",
          description: "other files in adev",
        }),
      ),
    ).toBe("other files in adev");
  });
});
