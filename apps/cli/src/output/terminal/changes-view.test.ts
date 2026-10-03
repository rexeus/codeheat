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

describe("biggest changes", () => {
  it("names the previous window and lists the five source files that warmed up most", () => {
    const view = plainView();

    expect(view).toContain("Biggest changes against 2024-09-29 to 2025-09-29");
    // analyze.test.ts (+0.22) is a test file and styles.css (+0.28) is new: neither is warming
    expect(section(view, "Warming files")).toEqual([
      "change  score  before  path",
      " +0.31   0.97    0.66  packages/billing/src/invoice.ts",
      " +0.31   0.42    0.11  packages/auth/src/tokens.ts",
      " +0.22   0.54    0.32  packages/shared/src/config.ts",
      " +0.14   0.70    0.56  apps/cli/src/commands/analyze.ts",
      " +0.14   0.38    0.24  apps/cli/src/output/terminal.ts",
    ]);
  });

  it("lists the three highest-ranked source files without revisions in the previous window", () => {
    const report = sampleReport();
    // a newly active test file ranked above the others must stay out
    const files = report.files.map((file) =>
      file.path === "packages/billing/src/invoice.test.ts"
        ? Object.assign({}, file, {
            trend: { previousScore: 0, scoreDelta: 0.78, newlyActive: true },
          })
        : file,
    );

    expect(section(plainView({ ...report, files }), "Newly active")).toEqual([
      "score  path",
      " 0.28  packages/web/src/styles.css",
      " 0.22  packages/billing/src/legacy/export-csv.ts",
      " 0.21  packages/auth/src/permissions.ts",
    ]);
  });

  it("lists the five modules whose cohesion moved most, either way", () => {
    expect(section(plainView(), "Cohesion changes")).toEqual([
      " change  cohesion  before  module",
      "-20 pts       53%     73%  packages/web",
      "+12 pts       40%     28%  packages/shared",
      " -8 pts       50%     58%  apps/cli",
      " -5 pts       61%     66%  packages/auth",
      " +3 pts       55%     52%  packages/billing",
    ]);
  });

  it("leaves out modules below the commit floor", () => {
    const report = sampleReport();
    const modules = report.modules.map((module) =>
      module.path === "packages/web"
        ? Object.assign({}, module, { commits: 4 })
        : module,
    );

    const lines = section(
      plainView({ ...report, modules }),
      "Cohesion changes",
    );

    expect(lines).toHaveLength(5);
    expect(lines.join("\n")).not.toContain("packages/web");
  });
});

describe("biggest changes without changes", () => {
  it("says so when nothing warmed up and no cohesion moved", () => {
    const report = sampleReport();
    const calm = {
      ...report,
      files: report.files.map((file) =>
        Object.assign({}, file, { trend: null }),
      ),
      modules: report.modules.map((module) =>
        Object.assign({}, module, { trend: null }),
      ),
    };

    const view = plainView(calm);

    expect(section(view, "Warming files")).toEqual(["No file got hotter."]);
    expect(section(view, "Newly active")).toEqual([
      "No source file became active.",
    ]);
    expect(section(view, "Cohesion changes")).toEqual([
      "No module changed in cohesion.",
    ]);
  });

  it("is absent without a comparison", () => {
    const view = plainView({ ...sampleReport(), comparison: null });

    expect(view).not.toContain("Biggest changes");
  });

  it("escapes control characters in the paths it lists", () => {
    const report = sampleReport();
    // No couplings: the renamed file would be missing from the coupled files.
    const hostile = {
      ...report,
      couplings: [],
      files: report.files.map((file) =>
        file.rank === 1
          ? Object.assign({}, file, { path: "src/a\u001B[31mb.ts" })
          : file,
      ),
    };

    expect(plainView(hostile)).not.toContain("\u001B");
  });
});

const withComparison = (
  changes: Partial<NonNullable<ReturnType<typeof sampleReport>["comparison"]>>,
) => {
  const report = sampleReport();
  return {
    ...report,
    comparison: Object.assign({}, report.comparison, changes),
  };
};

describe("biggest changes without comparison data", () => {
  it("says there is no comparison data instead of listing nothing when the previous window has no commits", () => {
    const view = plainView(withComparison({ previousCommits: 0 }));

    expect(section(view, "Biggest changes")).toEqual([
      "No comparison data: the previous window has no commits.",
    ]);
    expect(view).not.toContain("Warming files");
  });

  it("says so when the latest window has no commits", () => {
    const report = sampleReport();

    const view = plainView({
      ...report,
      window: Object.assign({}, report.window, { commits: 0 }),
    });

    expect(section(view, "Biggest changes")).toEqual([
      "No comparison data: the latest window has no commits.",
    ]);
  });

  it("notes a previous window cut off at the start of the history, keeping the lists", () => {
    const view = plainView(withComparison({ previousTruncated: true }));

    expect(section(view, "Biggest changes")[0]).toMatch(
      /^Note: the previous window reaches back past the oldest commit/u,
    );
    expect(view).toContain("Warming files");
  });

  it("gives both reasons when an empty previous window is also cut off", () => {
    const lines = section(
      plainView(
        withComparison({ previousCommits: 0, previousTruncated: true }),
      ),
      "Biggest changes",
    );

    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe(
      "No comparison data: the previous window has no commits.",
    );
  });
});
