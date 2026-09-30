import { describe, expect, it } from "vitest";

import { sampleReport } from "../../testing/sample-report.js";
import { renderAnalysis } from "./analysis-view.js";
import { makeStyle } from "./style.js";

const plainView = (report = sampleReport()): string =>
  renderAnalysis(report, makeStyle(false));

const section = (view: string, heading: string): ReadonlyArray<string> => {
  const lines = view.split("\n");
  const start = lines.findIndex((line) => line.startsWith(heading));
  const end = lines.findIndex((line, index) => index > start && line === "");
  return lines.slice(start + 1, end === -1 ? undefined : end);
};

describe("renderAnalysis", () => {
  it("summarizes the repository, window and universe size", () => {
    expect(plainView().split("\n")[0]).toBe(
      "acme-shop  2025-09-29 to 2026-09-29  212 commits, 36 files",
    );
  });

  it("lists the ten hottest files with rank, score bar, revisions and complexity", () => {
    const hotspots = section(plainView(), "Hotspots");

    expect(hotspots).toHaveLength(11);
    expect(hotspots[0]).toBe(
      "rank  score" + " ".repeat(12) + "revisions  complexity  path",
    );
    expect(hotspots[1]).toBe(
      "  #1  ██████████ 0.97         48        1900  packages/billing/src/invoice.ts",
    );
    expect(hotspots[10]).toBe(
      " #10  ████░░░░░░ 0.43         12         160  packages/web/src/hooks/use-session.ts",
    );
  });

  it("lists the five strongest couplings and leaves test pairs out", () => {
    const couplings = section(plainView(), "Change coupling");

    expect(couplings).toEqual([
      "degree  shared  distance  files",
      "   75%       6         4  packages/billing/src/index.ts <-> packages/auth/src/index.ts",
      "   61%      24         0  packages/billing/src/invoice.ts <-> packages/billing/src/tax.ts",
      "   53%       9         5  packages/auth/src/session.ts <-> packages/web/src/hooks/use-session.ts",
      "   42%       9         7  packages/shared/src/config.ts <-> apps/cli/src/commands/analyze.ts",
      "   42%      14         5  packages/billing/src/invoice.ts <-> packages/web/src/routes/invoices.tsx",
    ]);
  });

  it("ends with one hint about the other output modes", () => {
    expect(plainView().split("\n").at(-1)).toBe(
      "Use --json for the full report.",
    );
  });
});

describe("renderAnalysis styling and safety", () => {
  it("carries no ANSI escape codes in plain style", () => {
    expect(plainView()).not.toContain("\u001B");
  });

  it("colors each score by heat in color style", () => {
    const view = renderAnalysis(sampleReport(), makeStyle(true));

    expect(view).toContain("\u001B[31m██████████ 0.97\u001B[0m");
    expect(view).toContain("\u001B[33m████░░░░░░ 0.43\u001B[0m");
  });

  it("escapes control characters and ANSI sequences in paths", () => {
    const report = sampleReport();
    const hostile = {
      ...report,
      files: report.files.map((file) =>
        file.rank === 1
          ? Object.assign({}, file, { path: "src/a\u001B[31m\nb.ts" })
          : file,
      ),
    };

    const view = plainView(hostile);

    expect(view).toContain("src/a\\u001b[31m\\u000ab.ts");
    expect(view).not.toContain("\u001B");
  });

  it("says so when the universe is empty and nothing is coupled", () => {
    const empty = { ...sampleReport(), files: [], couplings: [] };

    expect(plainView(empty)).toContain("No files in the analysis universe.");
    expect(plainView(empty)).toContain(
      "No change coupling above the thresholds.",
    );
  });
});
