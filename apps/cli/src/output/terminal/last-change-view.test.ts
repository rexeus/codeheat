import { describe, expect, it } from "vitest";

import { sampleReport } from "../../testing/sample-report.js";
import { lastChangeLines } from "./last-change-view.js";

const withWindow = (
  window: Partial<ReturnType<typeof sampleReport>["window"]>,
) => {
  const report = sampleReport();
  return { window: { ...report.window, ...window } };
};

describe("lastChangeLines", () => {
  it("names the day of the newest commit when the window has no counted changes", () => {
    expect(
      lastChangeLines(
        withWindow({
          commits: 0,
          realCommits: 0,
          lastCommitAt: "2025-03-14T12:30:00.000Z",
        }),
      ),
    ).toStrictEqual([
      "No counted changes in this window; the newest commit of the repository was on 2025-03-14.",
    ]);
  });

  it("does the same for a window of mechanical commits only", () => {
    expect(
      lastChangeLines(
        withWindow({
          commits: 3,
          realCommits: 0,
          lastCommitAt: "2026-09-01T08:00:00.000Z",
        }),
      ),
    ).toStrictEqual([
      "No counted changes in this window; the newest commit of the repository was on 2026-09-01.",
    ]);
  });

  it("says nothing for a window with changes", () => {
    expect(
      lastChangeLines(
        withWindow({
          realCommits: 4,
          lastCommitAt: "2026-09-27T16:42:10.000Z",
        }),
      ),
    ).toStrictEqual([]);
  });

  it("says nothing for a repository without commits", () => {
    expect(
      lastChangeLines(
        withWindow({ commits: 0, realCommits: 0, lastCommitAt: null }),
      ),
    ).toStrictEqual([]);
  });
});
