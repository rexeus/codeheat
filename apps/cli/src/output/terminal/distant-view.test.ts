import type { Analysis } from "@codeheat/engine";
import { describe, expect, it } from "vitest";

import { sampleReport } from "../../testing/sample-report.js";
import { cliqueSection, distantSection } from "./distant-view.js";
import { makeStyle } from "./style.js";

type Clique = Analysis["cliques"][number];

const clique = (modules: ReadonlyArray<string>, sharedCommits = 6): Clique => ({
  modules,
  sharedCommits,
  weakestShare: 0.4,
  reason: `${modules.length} modules of which every pair shares at least 40% of the smaller one's changes; ${sharedCommits} changes touched all of them`,
});

describe("distantSection", () => {
  it("says what distant means with the distance of the report", () => {
    const report = sampleReport();

    const [heading] = distantSection(
      { ...report, thresholds: { ...report.thresholds, minLocalDistance: 5 } },
      makeStyle(false),
    );

    expect(heading).toBe(
      "Distant coupling (in different modules, or at least 5 directories apart within one module; tests excluded)",
    );
  });

  it("tabulates the best ranked distant couplings, hidden ones marked", () => {
    expect(distantSection(sampleReport(), makeStyle(false))).toEqual([
      "Distant coupling (in different modules, or at least 3 directories apart within one module; tests excluded)",
      "score  degree  shared  imports  files",
      " 1.74     75%       6  hidden   packages/billing/src/index.ts <-> packages/auth/src/index.ts",
      " 1.62     42%      14  hidden   packages/billing/src/invoice.ts <-> packages/web/src/routes/invoices.tsx",
      " 1.25     42%       9  b→a      packages/shared/src/config.ts <-> apps/cli/src/commands/analyze.ts",
      " 1.23     53%       9  b→a      packages/auth/src/session.ts <-> packages/web/src/hooks/use-session.ts",
      "",
    ]);
  });

  it("shows at most five pairs", () => {
    const [pair] = sampleReport().distantCouplings;
    const report = {
      ...sampleReport(),
      distantCouplings: Array.from({ length: 8 }, () => pair).filter(
        (each) => each !== undefined,
      ),
    };

    expect(distantSection(report, makeStyle(false))).toHaveLength(8);
  });

  it("has no lines without distant couplings", () => {
    const report = { ...sampleReport(), distantCouplings: [] };

    expect(distantSection(report, makeStyle(false))).toEqual([]);
  });

  it("escapes control characters in paths", () => {
    const [pair] = sampleReport().distantCouplings;
    const report = {
      ...sampleReport(),
      distantCouplings:
        pair === undefined ? [] : [{ ...pair, a: "a\u001B[2Jb" }],
    };

    expect(distantSection(report, makeStyle(false)).join("\n")).not.toContain(
      "\u001B",
    );
  });
});

describe("cliqueSection", () => {
  it("has a line per clique with its members and reason", () => {
    const report = {
      ...sampleReport(),
      cliques: [clique(["packages/a", "packages/b", "packages/c"], 12)],
    };

    expect(cliqueSection(report, makeStyle(false))).toEqual([
      "Change together (modules)",
      "packages/a + packages/b + packages/c: 3 modules of which every pair shares at least 40% of the smaller one's changes; 12 changes touched all of them",
      "",
    ]);
  });

  it("shows three cliques and counts the rest", () => {
    const report = {
      ...sampleReport(),
      cliques: ["a", "b", "c", "d", "e"].map((name) =>
        clique([`${name}1`, `${name}2`, `${name}3`]),
      ),
    };

    const lines = cliqueSection(report, makeStyle(false));

    expect(lines).toHaveLength(6);
    expect(lines[4]).toBe("+2 more; see cliques in --json");
  });

  it("says when the search for cliques was cut short", () => {
    const report = { ...sampleReport(), cliquesPartial: true };

    expect(cliqueSection(report, makeStyle(false))).toEqual([
      "Change together (modules)",
      "The search was cut short; a clique may be missing (cliquesPartial in --json).",
      "",
    ]);
  });

  it("has no lines without cliques", () => {
    expect(cliqueSection(sampleReport(), makeStyle(false))).toEqual([]);
  });
});
