import { describe, expect, it } from "vitest";

import {
  changeStep,
  comparableChange,
  dominantChange,
} from "./change-scale.js";

describe("changeStep", () => {
  it("gives a file without comparison data its own step, apart from unchanged", () => {
    expect(changeStep(null)).toBe(0);
    expect(changeStep(0)).toBe(4);
  });

  // Each case: score change, expected step; bounds are exclusive on the upper side.
  it.each([
    [0.019, 4],
    [0.02, 5],
    [0.099, 5],
    [0.1, 6],
    [0.249, 6],
    [0.25, 7],
    [1, 7],
    [-0.019, 4],
    [-0.02, 3],
    [-0.099, 3],
    [-0.1, 2],
    [-0.249, 2],
    [-0.25, 1],
    [-1, 1],
  ])("puts a change of %s on step %s", (delta, step) => {
    expect(changeStep(delta)).toBe(step);
  });
});

describe("comparableChange", () => {
  it("is the score change of a file that was active in both windows", () => {
    expect(
      comparableChange({
        previousScore: 0.5,
        previousRevisions: 5,
        scoreDelta: -0.2,
        newlyActive: false,
      }),
    ).toBe(-0.2);
  });

  it("is null for a newly active file, so it gets the no-data color instead of maximum warming", () => {
    expect(
      comparableChange({
        previousScore: 0,
        previousRevisions: 0,
        scoreDelta: 0.9,
        newlyActive: true,
      }),
    ).toBeNull();
  });

  it("is null without a trend", () => {
    expect(comparableChange(null)).toBeNull();
  });
});

describe("dominantChange", () => {
  it("is the larger move in absolute terms, so a strong cooling is not hidden behind a weak warming", () => {
    expect(dominantChange({ rise: 0.05, drop: -0.3 })).toBe(-0.3);
    expect(dominantChange({ rise: 0.4, drop: -0.1 })).toBe(0.4);
  });

  it("goes to the rise on a tie and stays 0 when nothing moved", () => {
    expect(dominantChange({ rise: 0.2, drop: -0.2 })).toBe(0.2);
    expect(dominantChange({ rise: 0, drop: 0 })).toBe(0);
  });
});
