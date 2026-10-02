import { describe, expect, it } from "vitest";

import { jaccard, shinglesOf } from "./similarity.js";

const words = (text: string): ReadonlyArray<string> => text.split(" ");

describe("shinglesOf", () => {
  it("has one shingle per run of five consecutive words", () => {
    expect(shinglesOf(words("a b c d e f")).size).toBe(2);
  });

  it("counts a repeated run once", () => {
    expect(shinglesOf(words("a a a a a a")).size).toBe(1);
  });

  it("has no shingle for fewer than five words", () => {
    expect(shinglesOf(words("a b c d")).size).toBe(0);
  });

  it("gives the same words the same shingles", () => {
    expect(
      jaccard(
        shinglesOf(words("a b c d e f")),
        shinglesOf(words("a b c d e f")),
      ),
    ).toBe(1);
  });

  it("tells runs apart by the order of their words", () => {
    expect(
      jaccard(shinglesOf(words("a b c d e")), shinglesOf(words("e d c b a"))),
    ).toBe(0);
  });

  it("shares the runs two word lists have in common", () => {
    // {abcde, bcdef} and {bcdef, cdefg}: one shared of three distinct
    expect(
      jaccard(
        shinglesOf(words("a b c d e f")),
        shinglesOf(words("b c d e f g")),
      ),
    ).toBeCloseTo(1 / 3, 10);
  });
});

describe("jaccard", () => {
  it("is 1 for equal sets", () => {
    expect(jaccard(new Set([1, 2]), new Set([2, 1]))).toBe(1);
  });

  it("is the shared share of the union", () => {
    // 2 shared of 6 distinct
    expect(jaccard(new Set([1, 2, 3, 4]), new Set([3, 4, 5, 6]))).toBeCloseTo(
      1 / 3,
      10,
    );
  });

  it("is 0 for disjoint sets", () => {
    expect(jaccard(new Set([1]), new Set([2]))).toBe(0);
  });

  it("is 0 for two empty sets", () => {
    expect(jaccard(new Set(), new Set())).toBe(0);
  });

  it("does not depend on the order of its arguments", () => {
    const small = new Set([1, 2]);
    const large = new Set([2, 3, 4, 5]);

    expect(jaccard(small, large)).toBe(jaccard(large, small));
    expect(jaccard(small, large)).toBe(0.2);
  });
});
