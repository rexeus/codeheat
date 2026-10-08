import { describe, expect, it } from "vitest";

import {
  dayOf,
  percentDownOf,
  percentOf,
  percentsOf,
  shareOf,
} from "./units.js";

describe("report v2 units", () => {
  it("rounds a share to a percent with 1 decimal and a ratio to 2 decimals", () => {
    expect(percentOf(0.9694)).toBe(96.9);
    expect(percentOf(0.0005)).toBe(0.1);
    expect(shareOf(0.6667)).toBe(0.67);
    expect(shareOf(0.125)).toBe(0.13);
  });

  it("rounds a share down to a percent, so it stays below the cut point the share stays below", () => {
    expect(percentDownOf(0.1995)).toBe(19.9);
    expect(percentDownOf(0.4995)).toBe(49.9);
    expect(percentDownOf(0.29)).toBe(29);
    expect(percentDownOf(0.2)).toBe(20);
  });

  it("reads the UTC day of an ISO timestamp", () => {
    expect(dayOf("2026-09-29T23:59:59.000Z")).toBe("2026-09-29");
  });
});

/** The tenths of a percent `percents` add up to, counted exactly. */
const tenthsIn = (percents: ReadonlyArray<number>): number =>
  percents.reduce((sum, percent) => sum + Math.round(percent * 10), 0);

describe("percentsOf", () => {
  it("hands the tenths that rounding down loses to the largest remainders", () => {
    // 33.33 + 33.33 + 33.34 percent: rounded alone, 33.3 + 33.3 + 33.3 = 99.9.
    expect(percentsOf([0.3333, 0.3333, 0.3334])).toEqual([33.3, 33.3, 33.4]);
  });

  it("keeps the parts from outgrowing the whole when each rounds up", () => {
    // Rounded alone, each of the four 0.05 remainders rounds up: 100.2.
    const percents = percentsOf([0.2505, 0.2505, 0.2505, 0.2485]);

    expect(percents).toEqual([25.1, 25.1, 25, 24.8]);
    expect(tenthsIn(percents)).toBe(1000);
  });

  it("adds 22 equal parts up to exactly 100", () => {
    // 1/22 is 0.0455 rounded, and 22 of those are 1.001 of the whole.
    const percents = percentsOf(Array.from({ length: 22 }, () => 0.0455));

    expect(percents).toEqual([
      ...Array.from({ length: 10 }, () => 4.6),
      ...Array.from({ length: 12 }, () => 4.5),
    ]);
    expect(tenthsIn(percents)).toBe(1000);
  });

  it("scales parts that fall short of the whole up to 100, and leaves no heat at 0", () => {
    expect(percentsOf([0.1234, 0.0006])).toEqual([99.5, 0.5]);
    expect(percentsOf([0, 0])).toEqual([0, 0]);
  });
});
