import { describe, expect, it } from "vitest";

import { containmentStep } from "./containment-scale.js";

describe("containmentStep", () => {
  it.each([
    [0, "leak-1"],
    [0.24, "leak-1"],
    [0.3, "leak-2"],
    [0.6, "leak-3"],
    [0.75, "leak-3"],
    [0.76, "hold-1"],
    [0.85, "hold-2"],
    [1, "hold-3"],
  ])("puts %f against a 75 %% line at %s", (containment, step) => {
    expect(containmentStep(containment, 0.75)).toBe(step);
  });

  it("has a step of its own for a territory without a containment", () => {
    expect(containmentStep(null, 0.75)).toBe("none");
  });
});
