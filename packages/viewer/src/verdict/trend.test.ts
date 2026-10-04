import { describe, expect, it } from "vitest";

import { erosionOf, reportWithParts } from "../testing/design-fit.js";
import { trendOf } from "./trend.js";

const report = reportWithParts([
  { id: "t1", path: "a", heat: 1, containment: 0.5 },
]);

describe("trendOf", () => {
  it.each([
    ["eroding", "worse", "Getting worse"],
    ["improving", "better", "Getting better"],
    ["holding", "steady", "Holding steady"],
    ["unknown", "none", "No trend yet"],
  ] as const)("reads %s as %s", (verdict, direction, label) => {
    expect(trendOf({ ...report, erosion: erosionOf(verdict, 8) })).toEqual({
      direction,
      label,
    });
  });

  it("calls no trend over fewer quarters than a verdict needs", () => {
    expect(trendOf({ ...report, erosion: erosionOf("eroding", 4) })).toEqual({
      direction: "none",
      label: "Too few quarters to call a trend",
    });
  });

  it("says there is no trend yet for a report without erosion", () => {
    expect(trendOf({ ...report, erosion: null }).label).toBe("No trend yet");
  });
});
