import { describe, expect, it } from "vitest";

import { fileRecord } from "../testing/file-record.js";
import { heatShareOf } from "./file-heat.js";

/** A file with `changes × (loc + complexity)` units of heat. */
const file = (path: string, changes: number, loc: number, complexity: number) =>
  fileRecord(path, "t1", {
    changes,
    loc,
    complexity: { total: complexity, mean: 0, max: 0 },
  });

describe("heatShareOf", () => {
  // heats of 30, 50, and 20
  const share = heatShareOf([
    file("a.ts", 2, 10, 5),
    file("b.ts", 1, 40, 10),
    file("c.ts", 4, 5, 0),
  ]);

  it("is the share of all the heat the named files hold", () => {
    expect(share(["a.ts"])).toBeCloseTo(0.3, 10);
    expect(share(["a.ts", "b.ts"])).toBeCloseTo(0.8, 10);
  });

  it("counts a file once however often it is named, and a path that is no file for nothing", () => {
    expect(share(["c.ts", "c.ts", "missing.ts"])).toBeCloseTo(0.2, 10);
  });

  it("is 0 when no file has any heat", () => {
    expect(heatShareOf([file("a.ts", 0, 10, 5)])(["a.ts"])).toBe(0);
  });
});
