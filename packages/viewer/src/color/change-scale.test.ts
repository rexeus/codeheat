import { describe, expect, it } from "vitest";

import { changeStep, comparableChange } from "./change-scale.js";

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
        scoreDelta: -0.2,
        newlyActive: false,
      }),
    ).toBe(-0.2);
  });

  it("is null for a newly active file, so it gets the no-data color instead of maximum warming", () => {
    expect(
      comparableChange({
        previousScore: 0,
        scoreDelta: 0.9,
        newlyActive: true,
      }),
    ).toBeNull();
  });

  it("is null without a trend", () => {
    expect(comparableChange(null)).toBeNull();
  });
});
