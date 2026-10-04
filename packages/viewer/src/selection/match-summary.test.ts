import { describe, expect, it } from "vitest";

import { fileStats } from "../testing/reports.js";
import { createPathMatcher } from "./filter.js";
import { matchSummary } from "./match-summary.js";

const files = ["core/a.ts", "core/b.ts", "web/c.ts"].map((path) =>
  fileStats(path),
);

describe("matchSummary", () => {
  it("says nothing without a filter", () => {
    expect(matchSummary(null, { files, territory: null })).toBe("");
  });

  it("counts against all the files", () => {
    expect(
      matchSummary(createPathMatcher("core"), { files, territory: null }),
    ).toBe("2 of 3 files match");
  });

  it("counts against the files of the zoomed territory and names it", () => {
    expect(
      matchSummary(createPathMatcher("a.ts"), {
        files: files.slice(0, 2),
        territory: "packages/core",
      }),
    ).toBe("1 of 2 files in packages/core match");
  });
});
