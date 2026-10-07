import { describe, expect, it } from "vitest";

import { windowsStaying } from "../testing/area-windows.js";
import { randomFrom } from "../testing/seeded-random.js";
import { judgeAreaTrend } from "./area-trend.js";

const LIMITS = { minWindowChanges: 10, minVerdictWindows: 5 };

const judge = (
  windows: ReadonlyArray<ReadonlyArray<ReadonlySet<string>>>,
  judged: ReadonlyArray<string> = ["t1"],
) => judgeAreaTrend(new Set(judged), windows, LIMITS);

describe("judgeAreaTrend", () => {
  it("calls six windows in which the judged area keeps ever less inside eroding", () => {
    expect(judge(windowsStaying([0.9, 0.8, 0.7, 0.6, 0.5, 0.4]))).toBe(
      "eroding",
    );
  });

  it("calls six windows in which it keeps ever more inside improving", () => {
    expect(judge(windowsStaying([0.4, 0.5, 0.6, 0.7, 0.8, 0.9]))).toBe(
      "improving",
    );
  });

  it("calls no trend from four windows, however far they fall", () => {
    expect(judge(windowsStaying([0.9, 0.7, 0.5, 0.3]))).toBe("unknown");
  });

  it("calls six windows that keep the same share inside holding", () => {
    expect(judge(windowsStaying([0.7, 0.7, 0.7, 0.7, 0.7, 0.7]))).toBe(
      "holding",
    );
  });

  it("leaves out a window with fewer than ten counted changes", () => {
    const windows = [
      ...windowsStaying([0.9, 0.8, 0.7, 0.6], { changes: 40 }),
      ...windowsStaying([0.5], { changes: 9 }),
    ];

    expect(judge(windows)).toBe("unknown");
  });

  it("reads only the judged areas: changes that touch no judged area say nothing", () => {
    const unjudged = windowsStaying([0.9, 0.8, 0.7, 0.6, 0.5, 0.4], {
      area: "t9",
    });

    expect(judge(unjudged)).toBe("unknown");
  });

  it("weighs the judged areas by their changes, so one area's fall in a few changes holds", () => {
    const steady = Array.from({ length: 90 }, () => new Set(["t2"]));
    const windows = windowsStaying([0.9, 0.8, 0.7, 0.6, 0.5, 0.4], {
      changes: 10,
    }).map((touched) => touched.concat(steady));

    expect(judge(windows, ["t1", "t2"])).toBe("holding");
  });
});

const JUDGED = ["t1", "t2", "t3"];

/**
 * One change of a flat design: with probability `stay` it touches one judged
 * area alone; otherwise it leaves, touching every judged area and one
 * elsewhere, so that a change that leaves touches several judged areas.
 */
const flatChange = (random: () => number, stay: number): ReadonlySet<string> =>
  random() < stay
    ? new Set([JUDGED[Math.floor(random() * JUDGED.length)] ?? "t1"])
    : new Set([...JUDGED, "elsewhere"]);

describe("judgeAreaTrend over a flat design", () => {
  it("holds in at least 95 % of simulated series whose share only wobbles", () => {
    const seeds = 1000;
    const verdicts = Array.from({ length: seeds }, (_, seed) => {
      const random = randomFrom(seed + 1);
      const windows = Array.from({ length: 8 }, () =>
        Array.from({ length: 12 }, () => flatChange(random, 0.8)),
      );
      return judge(windows, JUDGED);
    });

    expect(
      verdicts.filter((verdict) => verdict === "holding").length / seeds,
    ).toBeGreaterThanOrEqual(0.95);
  });
});
