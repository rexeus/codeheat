import { describe, expect, it } from "vitest";

import type { SeriesWindow } from "../report/series.js";
import { randomFrom } from "../testing/seeded-random.js";
import { judgeErosion } from "./repository-erosion.js";

/** How many of `changes` stay in one module when each does with `probability`. */
const localChanges = (
  random: () => number,
  changes: number,
  probability: number,
): number =>
  Array.from({ length: changes }, () => random()).filter(
    (draw) => draw < probability,
  ).length;

const window = (local: number, changes: number): SeriesWindow => ({
  since: "2026-01-01T00:00:00.000Z",
  until: "2026-04-01T00:00:00.000Z",
  changes,
  active: true,
  changeRadius: { changes, median: 1, p90: 2, local: local / changes },
  propagationCost: null,
});

/**
 * `windows` windows of `changesPerWindow` changes each, whose share of local
 * changes starts at 70 % and falls by `drift` over the series, drawn by chance.
 */
const verdictOfSeed = (
  seed: number,
  windows: number,
  changesPerWindow: number,
  drift: number,
) => {
  const random = randomFrom(seed);
  const series = Array.from({ length: windows }, (_, index) =>
    window(
      localChanges(
        random,
        changesPerWindow,
        0.7 - (drift * index) / (windows - 1),
      ),
      changesPerWindow,
    ),
  );
  return judgeErosion(series)?.verdict;
};

const SEEDS = 2000;

/** The share of `SEEDS` cases with each verdict. */
const verdictShares = (
  windows: number,
  changesPerWindow: number,
  drift: number,
) => {
  const counts = { eroding: 0, improving: 0, holding: 0, unknown: 0 };
  for (let seed = 1; seed <= SEEDS; seed += 1) {
    const verdict = verdictOfSeed(seed, windows, changesPerWindow, drift);
    if (verdict !== undefined) {
      counts[verdict] += 1;
    }
  }
  return {
    eroding: counts.eroding / SEEDS,
    improving: counts.improving / SEEDS,
    holding: counts.holding / SEEDS,
  };
};

/** Six windows of 40 changes at about 70 % local, the last one at the share `end`. */
const verdictWithEnd = (end: number) =>
  judgeErosion(
    [0.7, 0.72, 0.68, 0.71, 0.69, end].map((local) => window(local * 40, 40)),
  )?.verdict;

/** Four windows of `changes` changes whose share falls from 80 % to 50 % in steps of ten points. */
const verdictOfFall = (changes: number) =>
  judgeErosion(
    [0.8, 0.7, 0.6, 0.5].map((local) => window(local * changes, changes)),
  )?.verdict;

describe("judgeErosion on a design whose share of local changes does not move", () => {
  // 60 changes a year: four quarters of 15, or eight of 7 or 8 over two years
  it.each([
    ["60 changes a year over 12 months", 4, 15],
    ["160 changes a year over 12 months", 4, 40],
    ["60 changes a year over 24 months", 8, 15],
    ["160 changes a year over 24 months", 8, 40],
    ["160 changes a year over 36 months", 12, 40],
  ])(
    "reads holding in at least 95 %% of the cases at %s",
    (_, windows, changes) => {
      expect(verdictShares(windows, changes, 0).holding).toBeGreaterThanOrEqual(
        0.95,
      );
    },
  );

  it("is not decided by one odd end window", () => {
    expect(verdictWithEnd(0.35)).toBe("holding");
    expect(verdictWithEnd(1)).toBe("holding");
  });
});

describe("judgeErosion on a design that drifts", () => {
  it("reads eroding for a real drift of 25 points over eight windows at 160 changes a year", () => {
    // eight quarters of 40 changes
    const shares = verdictShares(8, 40, 0.25);

    expect(shares.eroding).toBeGreaterThanOrEqual(0.65);
    expect(shares.improving).toBe(0);
  });

  it("reads eroding for the same drift when the shares are exact", () => {
    const series = Array.from({ length: 8 }, (_, index) =>
      window(Math.round(40 * (0.7 - (0.25 * index) / 7)), 40),
    );

    expect(judgeErosion(series)?.verdict).toBe("eroding");
  });

  it("reads improving for a rise of the same size", () => {
    const series = Array.from({ length: 8 }, (_, index) =>
      window(Math.round(40 * (0.45 + (0.25 * index) / 7)), 40),
    );

    expect(judgeErosion(series)?.verdict).toBe("improving");
  });

  it("asks for a bigger move of a series of few changes", () => {
    expect(verdictOfFall(100)).toBe("eroding");
    expect(verdictOfFall(15)).toBe("holding");
  });
});
