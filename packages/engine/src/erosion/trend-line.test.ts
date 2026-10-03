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

  it("takes the median slope and the median intercept", () => {
    // x 0..3, y .9 .8 .5 .3: slopes -.1 -.2 -.2 -.3 -.25 -.2, median -.2;
    // intercepts .9 1 .9 .9, median .9
    expect(fitLine(at(0.9, 0.8, 0.5, 0.3))).toStrictEqual({
      from: 0.9,
      to: 0.3,
      slope: -0.2,
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

  it("is not turned by one odd window at either end", () => {
    expect(fitLine(at(0.7, 0.7, 0.7, 0.7, 0.7, 0.2))).toStrictEqual({
      from: 0.7,
      to: 0.7,
      slope: 0,
    });
    expect(fitLine(at(0.2, 0.7, 0.7, 0.7, 0.7, 0.7))).toStrictEqual({
      from: 0.7,
      to: 0.7,
      slope: 0,
    });
  });

  it("reports the line's own values, without holding them to 0 and 1", () => {
    // slopes -.2 -.25 -.2667 -.3 -.3 -.3, median -.2833; intercepts 1 1.0833 1.0667 1.05, median 1.0583
    expect(fitLine(at(1, 0.8, 0.5, 0.2))).toStrictEqual({
      from: 1.0583,
      to: 0.2083,
      slope: -0.2833,
    });
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
