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
      "degree  shared  distance  a → b  b → a  files",
      "   75%       6         4    67%    86%  packages/billing/src/index.ts <-> packages/auth/src/index.ts",
      "   61%      24         0    50%    77%  packages/billing/src/invoice.ts <-> packages/billing/src/tax.ts",
      "   53%       9         5    41%    75%  packages/auth/src/session.ts <-> packages/web/src/hooks/use-session.ts",
      "   42%       9         7    53%    35%  packages/shared/src/config.ts <-> apps/cli/src/commands/analyze.ts",
      "   42%      14         5    29%    74%  packages/billing/src/invoice.ts <-> packages/web/src/routes/invoices.tsx",
    ]);
  });

  it("shows the co-change probability of each side from its own revisions", () => {
    const report = sampleReport();
    const revisionsByPath = new Map([
      ["packages/billing/src/index.ts", 8],
      ["packages/auth/src/index.ts", 12],
    ]);
    const adjusted = {
      ...report,
      files: report.files.map((file) =>
        Object.assign({}, file, {
          revisions: revisionsByPath.get(file.path) ?? file.revisions,
        }),
      ),
    };

    expect(section(plainView(adjusted), "Change coupling")[1]).toBe(
      "   75%       6         4    75%    50%  packages/billing/src/index.ts <-> packages/auth/src/index.ts",
    );
  });

  it("refuses a report that was cut before its coupled files", () => {
    const report = sampleReport();
    const cut = { ...report, files: report.files.slice(0, 1) };

    expect(() => plainView(cut)).toThrow(/missing from the report's files/u);
  });

  it("ends with one hint about the other output modes", () => {
    expect(plainView().split("\n").at(-1)).toBe(
      "Use --html for the treemap or --json for the full report.",
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
    const original = "packages/billing/src/invoice.ts";
    const path = "src/a\u001B[31m\nb.ts";
    const rename = (name: string): string => (name === original ? path : name);
    const hostile = {
      ...report,
      files: report.files.map((file) =>
        Object.assign({}, file, { path: rename(file.path) }),
      ),
      couplings: report.couplings.map((coupling) =>
        Object.assign({}, coupling, {
          a: rename(coupling.a),
          b: rename(coupling.b),
        }),
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
