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

describe("renderAnalysis modules", () => {
  it("lists the five least cohesive modules with their top partner", () => {
    const modules = section(plainView(), "Least cohesive modules");

    expect(modules).toEqual([
      "cohesion  commits  module            changes most with",
      "     40%       30  packages/shared   apps/cli (11)",
      "     50%       26  apps/cli          packages/shared (11)",
      "     53%       58  packages/web      packages/billing (20)",
      "     55%       74  packages/billing  packages/web (20)",
      "     61%       44  packages/auth     packages/web (14)",
    ]);
  });

  it("leaves out modules below the commit floor, however incohesive", () => {
    const report = sampleReport();
    const tiny = report.modules
      .slice(0, 1)
      .map((module) =>
        Object.assign({}, module, { path: "tiny", commits: 4, cohesion: 0 }),
      );

    const modules = section(
      plainView({ ...report, modules: [...tiny, ...report.modules] }),
      "Least cohesive modules",
    );

    expect(modules.filter((line) => line.includes("tiny"))).toEqual([]);
    expect(modules).toHaveLength(6);
  });
});

describe("renderAnalysis module ranking", () => {
  it("leaves out test-only modules", () => {
    const report = sampleReport();
    const tests = report.modules.slice(0, 1).map((module) =>
      Object.assign({}, module, {
        path: "e2e",
        testOnly: true,
        cohesion: 0,
      }),
    );

    const modules = section(
      plainView({ ...report, modules: [...tests, ...report.modules] }),
      "Least cohesive modules",
    );

    expect(modules.filter((line) => line.includes("e2e"))).toEqual([]);
    expect(modules).toHaveLength(6);
  });

  it("keeps the order of the report instead of sorting again", () => {
    const report = sampleReport();
    const reversed = report.modules.toReversed();

    const modules = section(
      plainView({ ...report, modules: reversed }),
      "Least cohesive modules",
    );

    expect(modules[1]).toContain("packages/auth");
  });

  it("escapes control characters in module paths", () => {
    const report = sampleReport();
    const hostile = report.modules
      .slice(0, 1)
      .map((module) => Object.assign({}, module, { path: "m\u001B[31m" }));

    const view = plainView({ ...report, modules: hostile });

    expect(view).toContain("m\\u001b[31m");
    expect(view).not.toContain("\u001B");
  });

  it("says so when no module has enough commits", () => {
    const report = sampleReport();
    const modules = report.modules.map((module) =>
      Object.assign({}, module, { commits: 4 }),
    );

    expect(
      section(plainView({ ...report, modules }), "Least cohesive"),
    ).toEqual(["No module has 5 or more counted commits."]);
  });
});

describe("renderAnalysis interfaces", () => {
  it("lists modules by how often their interface changes with their implementation", () => {
    const interfaces = section(plainView(), "Leakiest interfaces");

    // 6 of 29, 6 of 43, and 9 of 71 implementation commits also changed an entry point
    expect(interfaces).toEqual([
      "leakage  commits  module            entry points",
      "    21%       29  packages/shared   packages/shared/src/index.ts",
      "    14%       43  packages/auth     packages/auth/src/index.ts",
      "    13%       71  packages/billing  packages/billing/src/index.ts",
    ]);
  });

  it("names two entry points and counts the rest", () => {
    const report = sampleReport();
    const modules = report.modules.map((module) =>
      module.path === "packages/shared"
        ? { ...module, entryPoints: ["a.ts", "b.ts", "c.ts", "d.ts"] }
        : module,
    );

    const interfaces = section(
      plainView({ ...report, modules }),
      "Leakiest interfaces",
    );

    expect(interfaces[1]).toContain("a.ts, b.ts +2 more");
  });
});

describe("renderAnalysis interfaces filtering and safety", () => {
  it("escapes control characters in entry points", () => {
    const report = sampleReport();
    const modules = report.modules.map((module) =>
      Object.assign({}, module, { entryPoints: ["i\u001B[31mndex.ts"] }),
    );

    const view = plainView({ ...report, modules });

    expect(view).toContain("i\\u001b[31mndex.ts");
    expect(view).not.toContain("\u001B");
  });

  it("leaves out test-only modules, however leaky", () => {
    const report = sampleReport();
    const modules = report.modules.map((module) =>
      module.path === "packages/shared"
        ? Object.assign({}, module, { testOnly: true })
        : module,
    );

    const interfaces = section(
      plainView({ ...report, modules }),
      "Leakiest interfaces",
    );

    expect(
      interfaces.filter((line) => line.includes("packages/shared")),
    ).toEqual([]);
    expect(interfaces).toHaveLength(3);
  });

  it("leaves out modules with too few implementation commits or no entry points", () => {
    const report = sampleReport();
    const modules = report.modules.map((module) =>
      Object.assign({}, module, { implementationCommits: 4 }),
    );

    expect(
      section(plainView({ ...report, modules }), "Leakiest interfaces"),
    ).toEqual([
      "No module has entry points and 5 or more implementation commits.",
    ]);
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
