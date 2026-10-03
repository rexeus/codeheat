import { describe, expect, it } from "vitest";

import type { SeriesWindow } from "../report/series.js";
import { judgeErosion } from "./repository-erosion.js";

/** A window with 20 changes of which `local` stay in one module; null for an inactive window. */
const seriesWindow = (local: number | null, cost = 0.1): SeriesWindow => ({
  since: "2026-01-01T00:00:00.000Z",
  until: "2026-04-01T00:00:00.000Z",
  changes: local === null ? 2 : 20,
  active: local !== null,
  changeRadius:
    local === null ? null : { changes: 20, median: 1, p90: 2, local },
  propagationCost: local === null ? null : { cost, files: 10 },
});

const verdictOf = (...locals: ReadonlyArray<number | null>) =>
  judgeErosion(locals.map((local) => seriesWindow(local)))?.verdict;

describe("judgeErosion", () => {
  it("calls a falling share of local changes eroding, with the line behind it", () => {
    expect(
      judgeErosion([
        seriesWindow(0.8),
        seriesWindow(0.7),
        seriesWindow(0.6),
        seriesWindow(0.5),
      ]),
    ).toStrictEqual({
      verdict: "eroding",
      inactiveSince: null,
      windows: 4,
      locality: { from: 0.8, to: 0.5, slope: -0.1 },
      propagationCost: { from: 0.1, to: 0.1, slope: 0 },
    });
  });

  it("calls a rising share improving", () => {
    expect(verdictOf(0.5, 0.6, 0.7, 0.8)).toBe("improving");
  });

  it("holds when the share moves less than the shift that counts", () => {
    expect(verdictOf(0.7, 0.66, 0.72, 0.68)).toBe("holding");
  });

  it("draws the line through the active windows only, however many quiet ones lie between", () => {
    const erosion = judgeErosion([
      seriesWindow(0.8),
      seriesWindow(null),
      seriesWindow(0.6),
      seriesWindow(null),
      seriesWindow(0.4),
      seriesWindow(0.4),
    ]);

    expect(erosion?.verdict).toBe("eroding");
    expect(erosion?.windows).toBe(4);
  });
});

describe("judgeErosion of a quiet repository", () => {
  it("judges the active period, not the quiet end that follows it", () => {
    const windows = [
      seriesWindow(0.9),
      seriesWindow(0.7),
      seriesWindow(0.5),
      seriesWindow(0.3),
      seriesWindow(null),
      seriesWindow(null),
    ];
    const erosion = judgeErosion(
      windows.map((window, index) =>
        Object.assign({}, window, {
          since: `2026-0${index + 1}-01T00:00:00.000Z`,
        }),
      ),
    );

    expect(erosion?.verdict).toBe("eroding");
    expect(erosion?.inactiveSince).toBe("2026-05-01T00:00:00.000Z");
  });

  it("never calls a quiet end an improvement: inactive windows are left out", () => {
    // a falling share followed by quiet is eroding, and a rising one improving, as without the quiet
    expect(verdictOf(0.9, 0.7, 0.5, 0.3, null, null)).toBe("eroding");
    expect(verdictOf(0.3, 0.5, 0.7, 0.9, null, null)).toBe("improving");
    expect(verdictOf(0.7, 0.66, 0.72, 0.68, null)).toBe("holding");
  });

  it("starts the quiet at the first of the trailing inactive windows only", () => {
    const quietInTheMiddle = [
      seriesWindow(0.9),
      seriesWindow(null),
      seriesWindow(0.7),
      seriesWindow(0.5),
    ];

    expect(judgeErosion(quietInTheMiddle)?.inactiveSince).toBeNull();
    expect(
      judgeErosion([...quietInTheMiddle, seriesWindow(null)])?.inactiveSince,
    ).toBe("2026-01-01T00:00:00.000Z");
  });

  it("is unknown, quiet since the first window, for a repository without an active window", () => {
    expect(
      judgeErosion([
        seriesWindow(null),
        seriesWindow(null),
        seriesWindow(null),
      ]),
    ).toStrictEqual({
      verdict: "unknown",
      inactiveSince: "2026-01-01T00:00:00.000Z",
      windows: 0,
      locality: null,
      propagationCost: null,
    });
  });

  it("is unknown with fewer than three active windows", () => {
    expect(verdictOf(null, null, 0.4, 0.9)).toBe("unknown");
  });

  it("has no erosion without windows", () => {
    expect(judgeErosion([])).toBeNull();
  });
});
