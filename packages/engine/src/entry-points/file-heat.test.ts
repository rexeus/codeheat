import { describe, expect, it } from "vitest";

import { fileRecord } from "../testing/file-record.js";
import { fileHeatOf } from "./file-heat.js";

/** A file with `changes × (loc + complexity)` units of heat. */
const file = (path: string, changes: number, loc: number, complexity: number) =>
  fileRecord(path, "t1", {
    changes,
    loc,
    complexity: { total: complexity, mean: 0, max: 0 },
  });

describe("fileHeatOf", () => {
  // heats of 30, 50, and 20
  const heat = fileHeatOf([
    file("a.ts", 2, 10, 5),
    file("b.ts", 1, 40, 10),
    file("c.ts", 4, 5, 0),
  ]);

  it("gives the share of all the heat that named files hold", () => {
    expect(heat.share(["a.ts"])).toBeCloseTo(0.3, 10);
    expect(heat.share(["a.ts", "b.ts"])).toBeCloseTo(0.8, 10);
  });

  it("counts a file once however often it is named, and a path that is no file for nothing", () => {
    expect(heat.share(["c.ts", "c.ts", "missing.ts"])).toBeCloseTo(0.2, 10);
  });

  it("scales the heat of each file by its weight", () => {
    // 30 × 1 + 50 × 0.5 of 100
    expect(
      heat.weighted([
        ["a.ts", 1],
        ["b.ts", 0.5],
      ]),
    ).toBeCloseTo(0.55, 10);
  });

  it("gives the counted changes of a file, and 0 for a path that is no file", () => {
    expect(heat.changesOf("c.ts")).toBe(4);
    expect(heat.changesOf("missing.ts")).toBe(0);
  });

  it("holds no share when no file has any heat", () => {
    const cold = fileHeatOf([file("a.ts", 0, 10, 5)]);

    expect(cold.share(["a.ts"])).toBe(0);
    expect(cold.weighted([["a.ts", 1]])).toBe(0);
  });
});
