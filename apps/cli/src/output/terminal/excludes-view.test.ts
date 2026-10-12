import { describe, expect, it } from "vitest";

import { excludedLines } from "./excludes-view.js";

describe("excludedLines", () => {
  it("counts the files and patterns of each source and names the pattern that took the most", () => {
    expect(
      excludedLines({
        excludes: [
          { pattern: "**/*.test.*", source: "default", files: 700 },
          { pattern: "**/*.spec.*", source: "default", files: 2901 },
          { pattern: "**/dist/**", source: "default", files: 0 },
          { pattern: ".repos/**", source: "user", files: 32 },
        ],
      }),
    ).toStrictEqual([
      "Left out: 3,633 files by 2 default patterns and 1 --exclude pattern (most: **/*.spec.* 2,901). --no-default-excludes keeps the 3,601 the defaults left out.",
    ]);
  });

  it("says the flag keeps them all when only default patterns left files out", () => {
    expect(
      excludedLines({
        excludes: [
          { pattern: "**/*.test.*", source: "default", files: 2 },
          { pattern: "**/dist/**", source: "default", files: 1 },
          { pattern: "gen/**", source: "user", files: 0 },
        ],
      }),
    ).toStrictEqual([
      "Left out: 3 files by 2 default patterns (most: **/*.test.* 2). --no-default-excludes keeps them.",
    ]);
  });

  it("names the one pattern that left files out, without the flag for the defaults when none took part", () => {
    expect(
      excludedLines({
        excludes: [{ pattern: "gen/**", source: "user", files: 1 }],
      }),
    ).toStrictEqual(["Left out: 1 file by 1 --exclude pattern (gen/**)."]);
  });

  it("says nothing when no pattern left a file out", () => {
    expect(
      excludedLines({
        excludes: [{ pattern: "**/dist/**", source: "default", files: 0 }],
      }),
    ).toStrictEqual([]);
  });
});
