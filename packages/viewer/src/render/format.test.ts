import { describe, expect, it } from "vitest";

import {
  describeScoreTrend,
  formatPointChange,
  formatRatio,
  formatScoreChange,
  plural,
} from "./format.js";

describe("formatScoreChange", () => {
  it("prints the sign, with a real minus sign", () => {
    expect(formatScoreChange(0.314)).toBe("+0.31");
    expect(formatScoreChange(-0.124)).toBe("\u22120.12");
  });

  it("prints no sign for a change that rounds to zero", () => {
    expect(formatScoreChange(0)).toBe("0.00");
    expect(formatScoreChange(0.004)).toBe("0.00");
    expect(formatScoreChange(-0.004)).toBe("0.00");
  });
});

describe("formatRatio", () => {
  it("keeps at most two decimals and separates thousands", () => {
    expect(formatRatio(13.2895)).toBe("13.29");
    expect(formatRatio(517.5)).toBe("517.5");
    expect(formatRatio(3122)).toBe("3,122");
  });
});

describe("formatPointChange", () => {
  it("prints whole percentage points with the sign", () => {
    expect(formatPointChange(0.124)).toBe("+12 pts");
    expect(formatPointChange(-0.05)).toBe("\u22125 pts");
  });

  it("prints no sign for a change that rounds to zero", () => {
    expect(formatPointChange(0)).toBe("0 pts");
    expect(formatPointChange(0.004)).toBe("0 pts");
  });
});

describe("describeScoreTrend", () => {
  it("states the signed score change and the earlier score", () => {
    expect(
      describeScoreTrend({
        previousScore: 0.66,
        previousRevisions: 30,
        scoreDelta: 0.31,
        newlyActive: false,
      }),
    ).toEqual({ value: "+0.31", note: "score change (was 0.66)" });
  });

  it("calls a file without earlier revisions new instead of reporting its delta", () => {
    expect(
      describeScoreTrend({
        previousScore: 0,
        previousRevisions: 0,
        scoreDelta: 0.8,
        newlyActive: true,
      }),
    ).toEqual({ value: "new", note: "no revisions in the previous window" });
  });
});

describe("plural", () => {
  it("uses the singular for exactly one and the plural otherwise", () => {
    expect(plural(1, "territory", "territories")).toBe("1 territory");
    expect(plural(0, "territory", "territories")).toBe("0 territories");
    expect(plural(1200, "territory", "territories")).toBe("1,200 territories");
  });
});
