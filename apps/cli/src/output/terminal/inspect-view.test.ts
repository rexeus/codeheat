import type { InspectResult, Module } from "@codeheat/engine";
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
  module: "packages/billing",
  loc: 964,
  complexity: { total: 1900, mean: 1.97, max: 9 },
  reasons: ["changed in 48 commits (#1 of 36)"],
  trend: null,
  of: 36,
  partners: [
    {
      path: "packages/billing/src/invoice.test.ts",
      sharedCommits: 31,
      probability: 0.646,
      testPair: true,
      crossesModule: false,
    },
    {
      path: "packages/billing/src/tax.ts",
      sharedCommits: 24,
      probability: 0.5,
      testPair: false,
      crossesModule: false,
    },
    {
      path: "packages/web/src/checkout.ts",
      sharedCommits: 12,
      probability: 0.25,
      testPair: false,
      crossesModule: true,
    },
  ],
};

const billing: Module = {
  path: "packages/billing",
  kind: "package",
  files: 9,
  testOnly: false,
  commits: 74,
  localCommits: 41,
  cohesion: 0.5541,
  partners: [
    { path: "packages/web", sharedCommits: 20 },
    { path: "packages/auth", sharedCommits: 9 },
  ],
  entryPoints: ["packages/billing/src/index.ts"],
  interfaceCommits: 9,
  implementationCommits: 71,
  leakage: 0.1268,
  leakyInterface: false,
  trend: null,
};

const result = (
  matches: InspectResult["matches"],
  modules: InspectResult["modules"] = [billing],
): InspectResult => ({
  schemaVersion: 1,
  window: {
    since: "2025-09-29T12:00:00.000Z",
    until: "2026-09-29T12:00:00.000Z",
    commits: 212,
    couplingCommits: 198,
  },
  matches,
  modules,
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
        "module packages/billing: 55% of 74 commits stay inside, most often with packages/web (20)",
        "- changed in 48 commits (#1 of 36)",
        "",
        "Changes together with",
        "co-change  shared  partner",
        "      65%      31  packages/billing/src/invoice.test.ts (test)",
        "      50%      24  packages/billing/src/tax.ts",
        "      25%      12  packages/web/src/checkout.ts (other module)",
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
    const hostile = { ...entry, path: "a\u001B[2J.ts", module: "m\u001B[2J" };
    const hostileModule = { ...billing, path: "m\u001B[2J" };

    const view = renderInspect(
      result([hostile], [hostileModule]),
      makeStyle(false),
    );

    expect(view).toContain("a\\u001b[2J.ts");
    expect(view).toContain("module m\\u001b[2J:");
    expect(view).not.toContain("\u001B");
  });
});

describe("renderInspect modules", () => {
  it("says when the module has no counted commits or no partner", () => {
    const quiet: Module = {
      ...billing,
      commits: 0,
      cohesion: null,
      partners: [],
    };
    const alone: Module = { ...billing, commits: 8, cohesion: 1, partners: [] };

    expect(renderInspect(result([entry], [quiet]), makeStyle(false))).toContain(
      "module packages/billing: no counted commits\n",
    );
    expect(renderInspect(result([entry], [alone]), makeStyle(false))).toContain(
      "module packages/billing: 100% of 8 commits stay inside\n",
    );
  });

  it("prints one module line per match, each from its own module", () => {
    const web = { ...entry, path: "packages/web/a.ts", module: "packages/web" };
    const webModule: Module = {
      ...billing,
      path: "packages/web",
      cohesion: 0.5,
      commits: 10,
      partners: [],
    };

    const view = renderInspect(
      result([entry, web], [billing, webModule]),
      makeStyle(false),
    );

    expect(view).toContain("module packages/billing: 55%");
    expect(view).toContain(
      "module packages/web: 50% of 10 commits stay inside\n",
    );
  });
});
