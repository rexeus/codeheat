import { describe, expect, it } from "vitest";

import { fitLine } from "./trend-line.js";

const at = (...values: ReadonlyArray<number>) =>
  values.map((value, index) => ({ index, value }));

describe("fitLine", () => {
  it("reads an exact line at its first and last point", () => {
    expect(fitLine(at(0.8, 0.6, 0.4))).toStrictEqual({
      from: 0.8,
      to: 0.4,
      slope: -0.2,
    });
  });

  it("fits through the points by least squares", () => {
    // x 0..3, y .9 .8 .5 .3: slope -1.05 / 5 = -0.21, mean y 0.625 at x 1.5
    expect(fitLine(at(0.9, 0.8, 0.5, 0.3))).toStrictEqual({
      from: 0.94,
      to: 0.31,
      slope: -0.21,
    });
  });

  it("follows the positions of the windows, not their count", () => {
    const points = [
      { index: 0, value: 0.9 },
      { index: 1, value: 0.7 },
      { index: 3, value: 0.3 },
    ];

    expect(fitLine(points)).toStrictEqual({ from: 0.9, to: 0.3, slope: -0.2 });
  });

  it("keeps the ends of the line within 0 and 1", () => {
    expect(fitLine(at(1, 0.8, 0.5, 0.2))).toStrictEqual({
      from: 1,
      to: 0.22,
      slope: -0.27,
    });
    expect(fitLine(at(0.1, 0.2, 0.9))?.from).toBe(0);
  });

  it("is a flat line for a constant measure", () => {
    expect(fitLine(at(0.5, 0.5, 0.5))).toStrictEqual({
      from: 0.5,
      to: 0.5,
      slope: 0,
    });
  });

  it("is null with fewer than three points", () => {
    expect(fitLine([])).toBeNull();
    expect(fitLine(at(0.5, 0.9))).toBeNull();
  });
});
