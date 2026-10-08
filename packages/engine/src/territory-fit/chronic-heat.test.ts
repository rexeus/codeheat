import { describe, expect, it } from "vitest";

import type { Heat } from "../model/heat.js";
import { chronicHeat } from "./chronic-heat.js";

const NODES = [
  { id: "r", parent: null },
  { id: "a", parent: "r" },
  { id: "a1", parent: "a" },
  { id: "b", parent: "r" },
];

const chronic: Heat = { kind: "chronic", hotWindows: 6, windows: 8 };
const acute: Heat = { kind: "acute", hotWindows: 2, windows: 8 };

/** A file of `territory` with `changes` changes and 10 lines (complexity 0): a heat of `changes × 10`. */
const file = (
  territory: string,
  changes: number,
  heat: Heat | null = null,
  test = false,
) => ({ territory, test, heat, changes, loc: 10, complexity: { total: 0 } });

describe("chronicHeat", () => {
  it("counts chronic and acute files and their share of the heat, below a territory included", () => {
    const result = chronicHeat(NODES, [
      file("a1", 3, chronic),
      file("a1", 1, acute),
      file("a", 6),
      file("b", 4),
    ]);

    expect(result.get("a1")).toStrictEqual({
      chronicFiles: 1,
      acuteFiles: 1,
      chronicShare: 0.75,
    });
    expect(result.get("a")).toStrictEqual({
      chronicFiles: 1,
      acuteFiles: 1,
      chronicShare: 0.3,
    });
    expect(result.get("r")).toStrictEqual({
      chronicFiles: 1,
      acuteFiles: 1,
      chronicShare: 0.2143,
    });
    expect(result.get("b")).toStrictEqual({
      chronicFiles: 0,
      acuteFiles: 0,
      chronicShare: 0,
    });
  });

  it("leaves test code out of both counts", () => {
    const result = chronicHeat(NODES, [
      file("b", 2, chronic),
      file("b", 50, chronic, true),
    ]);

    expect(result.get("b")).toStrictEqual({
      chronicFiles: 1,
      acuteFiles: 0,
      chronicShare: 1,
    });
  });

  it("has no share without any heat", () => {
    expect(chronicHeat(NODES, [file("b", 0)]).get("b")?.chronicShare).toBe(0);
  });
});
