import { describe, expect, it } from "vitest";

import type { SeriesWindow } from "../model/series.js";
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

/** A window of the series whose share of local changes the test draws away from the rest. */
type Odd = "first" | "last" | undefined;

/** The series a simulated case draws. */
type Shape = {
  readonly windows: number;
  readonly changesPerWindow: number;
  readonly drift: number;
  readonly odd: Odd;
};

/**
 * `windows` windows of `changesPerWindow` changes each, whose share of local
 * changes starts at 70 % and falls by `drift` over the series, drawn by
 * chance; the `odd` window, if any, has a share of 30 % whatever the rest do.
 */
const verdictOfSeed = (
  seed: number,
  { windows, changesPerWindow, drift, odd }: Shape,
) => {
  const random = randomFrom(seed);
  const series = Array.from({ length: windows }, (_, index) => {
    const isOdd =
      (odd === "first" && index === 0) ||
      (odd === "last" && index === windows - 1);
    return window(
      localChanges(
        random,
        changesPerWindow,
        isOdd ? 0.3 : 0.7 - (drift * index) / (windows - 1),
      ),
      changesPerWindow,
    );
  });
  return judgeErosion(series)?.verdict;
};

const SEEDS = 2000;

/** The share of `SEEDS` cases with each verdict. */
const verdictShares = (
  windows: number,
  changesPerWindow: number,
  drift: number,
  odd?: Odd,
) => {
  const counts = { eroding: 0, improving: 0, holding: 0, unknown: 0 };
  for (let seed = 1; seed <= SEEDS; seed += 1) {
    const verdict = verdictOfSeed(seed, {
      windows,
      changesPerWindow,
      drift,
      odd,
    });
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

/** `windows` windows of `changes` changes whose share moves in equal steps from `from` to `to`. */
const exactSeries = (
  windows: number,
  changes: number,
  from: number,
  to: number,
) =>
  Array.from({ length: windows }, (_, index) =>
    window(
      Math.round(changes * (from + ((to - from) * index) / (windows - 1))),
      changes,
    ),
  );

/** Six windows of `changes` changes whose share falls from 80 % to 50 %. */
const verdictOfFall = (changes: number) =>
  judgeErosion(exactSeries(6, changes, 0.8, 0.5))?.verdict;

/** Seven windows of 125 changes at about 70 % local, the last one at the share `end`. */
const withEnd = (end: number) =>
  judgeErosion(
    [0.7, 0.72, 0.68, 0.71, 0.69, 0.7, end].map((local) =>
      window(local * 125, 125),
    ),
  )?.verdict;

describe("judgeErosion on a design whose share of local changes does not move", () => {
  // 60 changes a year: four quarters of 15, or eight of 15 over two years
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

  it.each([
    [15, "first"],
    [15, "last"],
    [40, "first"],
    [40, "last"],
    [125, "first"],
    [125, "last"],
  ] as const)(
    "reads holding in at least 95 %% of the cases with one odd window, at %i changes a window and the %s window odd",
    (changes, odd) => {
      expect(verdictShares(8, changes, 0, odd).holding).toBeGreaterThanOrEqual(
        0.95,
      );
    },
  );

  it("is not decided by one odd end window, however far off", () => {
    expect(withEnd(0.2)).toBe("holding");
    expect(withEnd(1)).toBe("holding");
  });
});

describe("judgeErosion on a design that drifts", () => {
  it("reads eroding for a real drift of 25 points over eight windows of 125 changes, and never improving", () => {
    const shares = verdictShares(8, 125, 0.25);

    expect(shares.eroding).toBeGreaterThanOrEqual(0.7);
    expect(shares.improving).toBe(0);
  });

  it("reads eroding for the same drift when the shares are exact, and improving for a rise", () => {
    expect(judgeErosion(exactSeries(8, 125, 0.7, 0.45))?.verdict).toBe(
      "eroding",
    );
    expect(judgeErosion(exactSeries(8, 125, 0.45, 0.7))?.verdict).toBe(
      "improving",
    );
  });

  it("asks for a bigger move of a series of few changes", () => {
    expect(verdictOfFall(100)).toBe("eroding");
    expect(verdictOfFall(15)).toBe("holding");
  });

  it("calls even an exact fall holding with fewer than five windows with evidence", () => {
    expect(judgeErosion(exactSeries(4, 1000, 0.9, 0.3))?.verdict).toBe(
      "holding",
    );
    expect(judgeErosion(exactSeries(5, 1000, 0.9, 0.3))?.verdict).toBe(
      "eroding",
    );
  });
});
