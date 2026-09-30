import { describe, expect, it } from "vitest";

import { sampleReport } from "../testing/sample-report.js";
import { limitReport } from "./limit-report.js";

describe("limitReport", () => {
  it("cuts files and couplings separately to the limit and keeps their order", () => {
    const limited = limitReport(sampleReport(), 3);

    expect(limited.files.map((file) => file.rank)).toEqual([1, 2, 3]);
    expect(limited.couplings.map((coupling) => coupling.degree)).toEqual([
      0.75, 0.738, 0.679,
    ]);
  });

  it("keeps the totals of the untruncated report", () => {
    expect(limitReport(sampleReport(), 3).totals).toEqual({
      files: 36,
      couplings: 8,
    });
  });

  it("keeps everything when the limit is 0", () => {
    const limited = limitReport(sampleReport(), 0);

    expect(limited.files).toHaveLength(36);
    expect(limited.couplings).toHaveLength(8);
  });

  it("keeps everything when the limit exceeds both lists", () => {
    const limited = limitReport(sampleReport(), 100);

    expect(limited.files).toHaveLength(36);
    expect(limited.couplings).toHaveLength(8);
  });
});
