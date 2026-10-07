import { describe, expect, it } from "vitest";

import { reportWithParts } from "../testing/design-fit.js";
import { trendOf } from "./trend.js";

const judgedWith = (trend: "eroding" | "improving" | "holding" | "unknown") =>
  reportWithParts(
    [{ id: "t1", path: "a", heat: 1, containment: 0.5, standing: "leaks" }],
    { verdict: { trend } },
  );

describe("trendOf", () => {
  it.each([
    ["eroding", "worse", "Getting worse"],
    ["improving", "better", "Getting better"],
    ["holding", "steady", "Holding steady"],
  ] as const)("reads %s as %s", (trend, direction, label) => {
    expect(trendOf(judgedWith(trend))).toEqual({ direction, label });
  });

  it("calls no trend over fewer quarters than a verdict needs", () => {
    expect(trendOf(judgedWith("unknown"))).toEqual({
      direction: "none",
      label: "Too few quarters to call a trend",
    });
  });

  it("says there is no trend yet when no territory is judged", () => {
    const report = reportWithParts([
      { id: "t1", path: "a", heat: 1, containment: 0.5 },
    ]);

    expect(trendOf(report)).toEqual({
      direction: "none",
      label: "No trend yet",
    });
  });
});
