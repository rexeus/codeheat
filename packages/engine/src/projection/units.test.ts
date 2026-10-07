import { describe, expect, it } from "vitest";

import { dayOf, percentOf, percentsOf, shareOf } from "./units.js";

describe("report v2 units", () => {
  it("rounds a share to a percent with 1 decimal and a ratio to 2 decimals", () => {
    expect(percentOf(0.9694)).toBe(96.9);
    expect(percentOf(0.0005)).toBe(0.1);
    expect(shareOf(0.6667)).toBe(0.67);
    expect(shareOf(0.125)).toBe(0.13);
  });

  it("reads the UTC day of an ISO timestamp", () => {
    expect(dayOf("2026-09-29T23:59:59.000Z")).toBe("2026-09-29");
  });
});

describe("percentsOf", () => {
  it("hands the tenths that rounding down loses to the largest remainders", () => {
    // 33.33 + 33.33 + 33.34 percent: rounded alone, 33.3 + 33.3 + 33.3 = 99.9.
    expect(percentsOf([0.3333, 0.3333, 0.3334])).toEqual([33.3, 33.3, 33.4]);
  });

  it("keeps the parts from outgrowing the whole when each rounds up", () => {
    // Rounded alone, each of the four 0.05 remainders rounds up: 100.2.
    const percents = percentsOf([0.2505, 0.2505, 0.2505, 0.2485]);

    expect(percents).toEqual([25.1, 25.1, 25, 24.8]);
    expect(percents.reduce((sum, percent) => sum + percent, 0)).toBeCloseTo(
      100,
      10,
    );
  });

  it("adds up to the percent of a sum below the whole", () => {
    expect(percentsOf([0.1234, 0.0006])).toEqual([12.3, 0.1]);
    expect(percentsOf([0, 0])).toEqual([0, 0]);
  });
});
