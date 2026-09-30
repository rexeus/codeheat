import type { InspectResult } from "@codeheat/engine";
import { describe, expect, it } from "vitest";

import { renderInspect } from "./inspect-view.js";
import { makeStyle } from "./style.js";

const entry: InspectResult["matches"][number] = {
  path: "packages/billing/src/invoice.ts",
  rank: 1,
  score: 0.97,
  revisions: 48,
  linesAdded: 384,
  linesDeleted: 672,
  breadth: 14,
  loc: 964,
  complexity: { total: 1900, mean: 1.97, max: 9 },
  reasons: ["changed in 48 commits (#1 of 36)"],
  of: 36,
  partners: [
    {
      path: "packages/billing/src/invoice.test.ts",
      sharedCommits: 31,
      probability: 0.646,
      testPair: true,
    },
    {
      path: "packages/billing/src/tax.ts",
      sharedCommits: 24,
      probability: 0.5,
      testPair: false,
    },
  ],
};

const result = (matches: InspectResult["matches"]): InspectResult => ({
  schemaVersion: 1,
  window: {
    since: "2025-09-29T12:00:00.000Z",
    until: "2026-09-29T12:00:00.000Z",
    commits: 212,
    couplingCommits: 198,
  },
  matches,
  unmatched: [],
});

describe("renderInspect", () => {
  it("shows the standing, metrics, reasons and partners of a file", () => {
    expect(renderInspect(result([entry]), makeStyle(false))).toBe(
      [
        "2025-09-29 to 2026-09-29",
        "",
        "packages/billing/src/invoice.ts",
        "rank #1 of 36, score 0.97",
        "48 revisions, 14 co-changed files, +384 -672 lines, 964 loc",
        "indentation complexity 1900 (mean 1.97, max 9)",
        "- changed in 48 commits (#1 of 36)",
        "",
        "Changes together with",
        "co-change  shared  partner",
        "      65%      31  packages/billing/src/invoice.test.ts (test)",
        "      50%      24  packages/billing/src/tax.ts",
      ].join("\n"),
    );
  });

  it("shows the complexity mean with at most two decimals", () => {
    const precise = {
      ...entry,
      complexity: { total: 261, mean: 1.1809, max: 6 },
    };

    expect(renderInspect(result([precise]), makeStyle(false))).toContain(
      "indentation complexity 261 (mean 1.18, max 6)",
    );
  });

  it("separates several matches and says when a file has no partners", () => {
    const lonely = { ...entry, path: "lonely.ts", partners: [] };

    const view = renderInspect(result([entry, lonely]), makeStyle(false));

    expect(view).toContain("\n\nlonely.ts\n");
    expect(view.split("\n").at(-1)).toBe(
      "No change coupling above the thresholds.",
    );
  });

  it("escapes control characters in paths", () => {
    const hostile = { ...entry, path: "a\u001B[2J.ts" };

    const view = renderInspect(result([hostile]), makeStyle(false));

    expect(view).toContain("a\\u001b[2J.ts");
    expect(view).not.toContain("\u001B");
  });
});
