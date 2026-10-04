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

  it("speaks of their changes and their edges for a boundary between two territories", () => {
    const stats = statsOf("boundary", {
      containment: 0.47,
      sharedChanges: 12,
      distantPairs: 7,
      fixShare: 0.2,
    });

    expect(stats.map(({ label }) => label)).toEqual([
      "of their changes stay inside one of the two",
      "changes touched both territories",
      "file pairs across their edges change together",
      "of their changes are fixes",
    ]);
  });

  it("speaks of its changes and its edge for the boundary of one territory", () => {
    const stats = statsOf("boundary", { containment: 0.47, distantPairs: 7 });

    expect(stats.map(({ label }) => label)).toEqual([
      "of its changes stay inside",
      "file pairs across its edge change together",
    ]);
  });
});
