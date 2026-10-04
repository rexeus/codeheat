import { describe, expect, it } from "vitest";

import { nonZeroStats, statsOf } from "./evidence.js";

describe("nonZeroStats", () => {
  it("drops a count of nothing and keeps the order of the rest", () => {
    const stats = statsOf("boundary", {
      containment: 0.6,
      distantPairs: 0,
      heatShare: 0.68,
    });

    expect(nonZeroStats(stats).map(({ value }) => value)).toEqual([
      "60%",
      "68%",
    ]);
  });

  it("keeps a share that rounds to less than a percent", () => {
    const stats = statsOf("boundary", { containment: 0.001 });

    expect(nonZeroStats(stats).map(({ value }) => value)).toEqual(["<1%"]);
  });
});
