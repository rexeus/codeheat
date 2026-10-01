import { describe, expect, it } from "vitest";

import { cohesionStep } from "./cohesion-scale.js";

describe("cohesionStep", () => {
  it("gives a module without data the neutral step", () => {
    expect(cohesionStep(null)).toBe(0);
  });

  it("does not mistake no data for perfect or zero cohesion", () => {
    expect(cohesionStep(0)).toBe(1);
    expect(cohesionStep(1)).toBe(6);
  });

  // Each case: cohesion, expected step; bounds are exclusive on the upper side.
  it.each([
    [0.2499, 1],
    [0.25, 2],
    [0.3, 2],
    [0.4, 3],
    [0.5, 3],
    [0.55, 4],
    [0.62, 4],
    [0.7, 5],
    [0.84, 5],
    [0.85, 6],
    [0.9, 6],
  ])("puts a cohesion of %s on step %s", (cohesion, step) => {
    expect(cohesionStep(cohesion)).toBe(step);
  });
});
