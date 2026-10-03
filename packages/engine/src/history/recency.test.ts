import { describe, expect, it } from "vitest";

import { weightAt } from "./recency.js";

const DAY = 86_400;
const END = 1_800_000_000;

/** The weight of a commit `ageSeconds` before the end of its window. */
const recencyWeight = (ageSeconds: number, halfLifeDays: number): number =>
  weightAt(END - ageSeconds, { windowEnd: END, halfLifeDays });

describe("recencyWeight", () => {
  it("weighs a change at the end of the window 1", () => {
    expect(recencyWeight(0, 180)).toBe(1);
  });

  it("halves the weight with every half-life of age", () => {
    expect(
      [30, 60, 90].map((days) => recencyWeight(days * DAY, 30)),
    ).toStrictEqual([0.5, 0.25, 0.125]);
  });

  it("weighs half a half-life like 0.5^0.5", () => {
    expect(recencyWeight(15 * DAY, 30)).toBeCloseTo(Math.SQRT1_2, 12);
  });

  it("weighs every change 1 when the half-life is 0", () => {
    expect(
      [0, 30 * DAY, 4000 * DAY].map((age) => recencyWeight(age, 0)),
    ).toStrictEqual([1, 1, 1]);
  });

  it("weighs a change dated after the end of the window like one at the end", () => {
    expect(recencyWeight(-5 * DAY, 30)).toBe(1);
  });

  it("keeps the weight of an ancient change above zero", () => {
    const weight = recencyWeight(100_000 * DAY, 1);

    expect(weight).toBeGreaterThan(0);
    expect(weight).toBeLessThan(1e-100);
  });
});
