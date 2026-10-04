import { describe, expect, it } from "vitest";

import { swarmOf } from "./swarm.js";

describe("swarmOf", () => {
  it("keeps dots that do not touch on the line", () => {
    expect(
      swarmOf([
        { x: 10, r: 4 },
        { x: 30, r: 4 },
      ]).map(({ y }) => y),
    ).toEqual([0, 0]);
  });

  it("moves a dot that would touch an earlier one off the line, up first, then down", () => {
    const placed = swarmOf([
      { x: 50, r: 6 },
      { x: 52, r: 3 },
      { x: 52, r: 3 },
    ]);

    // The dots must lie 6 + 3 + 1 apart: one step of 5 is too close, two steps clear it.
    expect(placed.map(({ y }) => y)).toEqual([0, -10, 10]);
  });

  it("places nothing for no dots", () => {
    expect(swarmOf([])).toEqual([]);
  });
});
