import { describe, expect, it } from "vitest";

import { scoreStep } from "./score-step.js";

describe("scoreStep", () => {
  it("gives a score of 0 the neutral step", () => {
    expect(scoreStep(0)).toBe(0);
  });

  it.each([
    [0.001, 1],
    [0.124, 1],
    [0.125, 2],
    [0.5, 5],
    [0.874, 7],
    [0.875, 8],
    [1, 8],
  ])("buckets a score of %s into step %s", (score, step) => {
    expect(scoreStep(score)).toBe(step);
  });
});
