import { describe, expect, it } from "vitest";

import { roundWeighted } from "./precision.js";

describe("roundWeighted", () => {
  it("rounds a weight sum of 0.1 or more to four decimals", () => {
    expect(
      [3.123_456, 0.123_456, 120].map((value) => roundWeighted(value)),
    ).toStrictEqual([3.1235, 0.1235, 120]);
  });

  it("keeps four significant digits of a weight below 0.1", () => {
    expect(
      [0.012_349, 0.000_123_49].map((value) => roundWeighted(value)),
    ).toStrictEqual([0.012_35, 0.000_123_5]);
  });

  it("keeps a positive weight positive however small", () => {
    expect(roundWeighted(1.2349e-9)).toBeGreaterThan(0);
    expect(roundWeighted(1e-300)).toBeGreaterThan(0);
  });

  it("keeps 0 at 0", () => {
    expect(roundWeighted(0)).toBe(0);
  });
});
