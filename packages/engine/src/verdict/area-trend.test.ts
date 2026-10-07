import { describe, expect, it } from "vitest";

import { windowsStaying } from "../testing/area-windows.js";
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

  it("pools the judged areas, so one area's fall is weighed by its touches", () => {
    const steady = Array.from({ length: 90 }, () => new Set(["t2"]));
    const windows = windowsStaying([0.9, 0.8, 0.7, 0.6, 0.5, 0.4], {
      changes: 10,
    }).map((touched) => touched.concat(steady));

    expect(judge(windows, ["t1", "t2"])).toBe("holding");
  });
});
