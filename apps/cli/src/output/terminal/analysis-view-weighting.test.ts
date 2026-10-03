import type { Report } from "@codeheat/engine";
import { describe, expect, it } from "vitest";

import { sampleReport } from "../../testing/sample-report.js";
import { renderAnalysis } from "./analysis-view.js";
import { makeStyle } from "./style.js";

const withHalfLife = (halfLifeDays: number): Report => {
  const report = sampleReport();
  return { ...report, thresholds: { ...report.thresholds, halfLifeDays } };
};

const view = (report: Report): ReadonlyArray<string> =>
  renderAnalysis(report, makeStyle(false)).split("\n");

describe("renderAnalysis without weighting", () => {
  it("notes in the summary that the numbers are unweighted", () => {
    expect(view(withHalfLife(0))[0]).toBe(
      "acme-shop  2025-09-29 to 2026-09-29  212 commits, 36 files, 2 contract files, unweighted",
    );
  });

  it("shows the plain revisions in the hotspot table, as before weighting existed", () => {
    const lines = view(withHalfLife(0));
    const start = lines.indexOf("Hotspots");

    expect(lines.slice(start + 1, start + 3)).toStrictEqual([
      "rank  score" + " ".repeat(12) + "revisions  complexity  path",
      "  #1  ██████████ 0.97         48        1900  packages/billing/src/invoice.ts",
    ]);
  });
});

describe("renderAnalysis summary", () => {
  it("names the half-life as the flag spells it", () => {
    const notes = [90, 365, 14, 10].map((days) =>
      view(withHalfLife(days))[0]?.split(", ").slice(3).join(", "),
    );

    expect(notes).toStrictEqual([
      "weighted by recency, half-life 3m",
      "weighted by recency, half-life 1y",
      "weighted by recency, half-life 2w",
      "weighted by recency, half-life 10d",
    ]);
  });
});
