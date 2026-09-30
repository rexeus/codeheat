import { describe, expect, it } from "vitest";

import { makeHeatScale } from "./heat-scale.js";

// 100 scored files with distinct scores 0.01..1.00, plus two unscored ones.
const scores = [
  0,
  0,
  ...Array.from({ length: 100 }, (_, index) => (index + 1) / 100),
];

describe("makeHeatScale", () => {
  const heat = makeHeatScale(scores);

  it("gives a score of 0 the neutral step", () => {
    expect(heat(0)).toBe(0);
  });

  // Each case: score, how many of the 100 scored files are hotter, expected step.
  it.each([
    [1, 0, 8],
    [0.99, 1, 8],
    [0.98, 2, 7],
    [0.95, 5, 6],
    [0.9, 10, 5],
    [0.8, 20, 4],
    [0.65, 35, 3],
    [0.5, 50, 2],
    [0.3, 70, 1],
    [0.01, 99, 1],
  ])("puts a score of %s (%s hotter files) into step %s", (score, _, step) => {
    expect(heat(score)).toBe(step);
  });

  it("gives equal scores the same step", () => {
    expect(makeHeatScale([0.4, 0.4, 0.4, 0.4])(0.4)).toBe(8);
  });

  it("keeps a report without any scored file neutral", () => {
    expect(makeHeatScale([0, 0])(0.5)).toBe(0);
  });
});
