import { describe, expect, it } from "vitest";

import { sampleReport } from "../../testing/sample-report.js";
import { makeStyle } from "./style.js";
import { summaryLines } from "./summary-view.js";

describe("summaryLines", () => {
  it("opens with the answer in one sentence and a blank line", () => {
    const lines = summaryLines(sampleReport(), makeStyle(false));

    expect(lines.slice(0, 2)).toEqual([
      "Under strain, getting worse: 100% of the change effort sits in areas that leak.",
      "",
    ]);
  });

  it("follows the summary with when the code last changed for a window without counted changes", () => {
    const report = sampleReport();
    const empty = {
      ...report,
      window: {
        ...report.window,
        commits: 0,
        realCommits: 0,
        lastCommitAt: "2025-03-14T12:30:00.000Z",
      },
    };

    const lines = summaryLines(empty, makeStyle(false));

    expect(lines[2]).toBe(
      "acme-shop  2025-09-29 to 2026-09-29  0 commits, 32 files, 2 contract files",
    );
    expect(lines[3]).toBe(
      "No counted changes in this window; the newest commit of the repository was on 2025-03-14.",
    );
  });

  it("goes on with how far a change spreads for a window with changes", () => {
    const lines = summaryLines(sampleReport(), makeStyle(false));

    expect(lines[3]).toMatch(/^Across \d+ changes?, /u);
  });
});
