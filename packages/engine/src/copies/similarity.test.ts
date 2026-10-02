import { describe, expect, it } from "vitest";

import { jaccard, shinglesOf } from "./similarity.js";

describe("shinglesOf", () => {
  it("lists the runs of five consecutive words", () => {
    expect([...shinglesOf(["a", "b", "c", "d", "e", "f"])]).toEqual([
      "a b c d e",
      "b c d e f",
    ]);
  });

  it("counts a repeated run once", () => {
    expect(shinglesOf(["a", "a", "a", "a", "a", "a"]).size).toBe(1);
  });

  it("has no shingle for fewer than five words", () => {
    expect(shinglesOf(["a", "b", "c", "d"]).size).toBe(0);
  });
});

describe("jaccard", () => {
  it("is 1 for equal sets", () => {
    expect(jaccard(new Set(["x", "y"]), new Set(["y", "x"]))).toBe(1);
  });

  it("is the shared share of the union", () => {
    // 2 shared of 6 distinct
    expect(
      jaccard(new Set(["a", "b", "c", "d"]), new Set(["c", "d", "e", "f"])),
    ).toBeCloseTo(1 / 3, 10);
  });

  it("is 0 for disjoint sets", () => {
    expect(jaccard(new Set(["a"]), new Set(["b"]))).toBe(0);
  });

  it("is 0 for two empty sets", () => {
    expect(jaccard(new Set(), new Set())).toBe(0);
  });

  it("does not depend on the order of its arguments", () => {
    const small = new Set(["a", "b"]);
    const large = new Set(["b", "c", "d", "e"]);

    expect(jaccard(small, large)).toBe(jaccard(large, small));
    expect(jaccard(small, large)).toBe(0.2);
  });
});
