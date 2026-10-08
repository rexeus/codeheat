import type { Coupling, Module, Analysis } from "@codeheat/engine";
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
  it("summarizes the repository, window and universe size below the answer", () => {
    expect(plainView().split("\n")[2]).toBe(
      "acme-shop  2025-09-29 to 2026-09-29  212 commits, 36 files, 2 contract files",
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

  it("ends with one hint about the other output modes", () => {
    expect(plainView().split("\n").at(-1)).toBe(
      "Use --html for the treemap or --json for the full report.",
    );
  });
});

describe("renderAnalysis coupling table", () => {
  it("lists the five strongest couplings and leaves test pairs out", () => {
    const couplings = section(plainView(), "Change coupling");

    expect(couplings).toEqual([
      "degree  shared  distance  a → b  b → a  imports  files",
      "   75%       6         4    67%    86%  hidden   packages/billing/src/index.ts <-> packages/auth/src/index.ts",
      "   61%      24         0    50%    77%  a→b      packages/billing/src/invoice.ts <-> packages/billing/src/tax.ts",
      "   58%      22         2    79%    46%  -        packages/billing/api/billing.tsp (contract) <-> packages/billing/src/invoice.ts",
      "   53%       9         5    41%    75%  b→a      packages/auth/src/session.ts <-> packages/web/src/hooks/use-session.ts",
      "   42%       9         7    53%    35%  b→a      packages/shared/src/config.ts <-> apps/cli/src/commands/analyze.ts",
      "Left out for changing in over 30% of changes: api/openapi.yaml (44%)",
    ]);
  });

  it("shows the co-change probability of each side from its own changes, not its commits", () => {
    const report = sampleReport();
    const changesByPath = new Map([
      ["packages/billing/src/index.ts", 8],
      ["packages/auth/src/index.ts", 12],
    ]);
    const adjusted = {
      ...report,
      files: report.files.map((file) =>
        Object.assign({}, file, {
          // more commits than changes: a pull request of several commits
          revisions: 90,
          changes: changesByPath.get(file.path) ?? file.changes,
        }),
      ),
    };

    expect(section(plainView(adjusted), "Change coupling")[1]).toBe(
      "   75%       6         4    75%    50%  hidden   packages/billing/src/index.ts <-> packages/auth/src/index.ts",
    );
  });

  it("refuses a report that was cut before its coupled files", () => {
    const report = sampleReport();
    const cut = { ...report, files: report.files.slice(0, 1) };

    expect(() => plainView(cut)).toThrow(
      /missing from the report's files and contracts/u,
    );
  });

  it("shows an unknown import relation as a dash and emphasizes hidden coupling in color", () => {
    const report = sampleReport();
    const couplings = report.couplings.map((coupling) => {
      if (coupling.a === "packages/billing/src/index.ts") {
        return { ...coupling, imports: null };
      }
      return coupling.b === "packages/billing/src/tax.ts"
        ? { ...coupling, imports: "none" as const }
        : coupling;
    });

    expect(
      renderAnalysis({ ...report, couplings }, makeStyle(false)),
    ).toContain(
      "   75%       6         4    67%    86%  -        packages/billing",
    );
    expect(renderAnalysis({ ...report, couplings }, makeStyle(true))).toContain(
      "   61%      24         0    50%    77%  \u001B[1mhidden \u001B[0m  packages/billing/src/invoice.ts",
    );
  });
});

describe("renderAnalysis modules", () => {
  it("lists the five least cohesive modules with their top partner", () => {
    const modules = section(plainView(), "Least cohesive modules");

    expect(modules).toEqual([
      "cohesion  changes  module            changes most with",
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
    ).toEqual(["No module has 5 or more counted changes."]);
  });
});

const withLeaky = (
  report: Analysis,
  leaky: ReadonlyArray<string>,
  change: Partial<Module> = {},
): Analysis => ({
  ...report,
  modules: report.modules.map((module) =>
    leaky.includes(module.path)
      ? { ...module, leakyInterface: true, ...change }
      : module,
  ),
});

describe("renderAnalysis leaky interfaces", () => {
  it("lists the flagged modules in the report's order", () => {
    const report = withLeaky(sampleReport(), [
      "packages/billing",
      "packages/shared",
    ]);

    const interfaces = section(plainView(report), "Leaky interfaces");

    // the sample lists shared before billing; leakage 6 of 29 and 9 of 71 implementation changes
    expect(interfaces).toEqual([
      "leakage  changes  module            entry points",
      "    21%       29  packages/shared   packages/shared/src/index.ts",
      "    13%       71  packages/billing  packages/billing/src/index.ts",
    ]);
  });

  it("names two entry points and counts the rest", () => {
    const report = withLeaky(sampleReport(), ["packages/shared"], {
      entryPoints: ["a.ts", "b.ts", "c.ts", "d.ts"],
    });

    const interfaces = section(plainView(report), "Leaky interfaces");

    expect(interfaces[1]).toContain("a.ts, b.ts +2 more");
  });

  it("escapes control characters in entry points", () => {
    const report = withLeaky(sampleReport(), ["packages/shared"], {
      entryPoints: ["i\u001B[31mndex.ts"],
    });

    const view = plainView(report);

    expect(view).toContain("i\\u001b[31mndex.ts");
    expect(view).not.toContain("\u001B");
  });

  it("says so when no module is flagged, however leaky its numbers look", () => {
    const report = sampleReport();
    const modules = report.modules.map((module) =>
      Object.assign({}, module, { leakage: 1 }),
    );

    expect(
      section(plainView({ ...report, modules }), "Leaky interfaces"),
    ).toEqual(["No module has a leaky interface."]);
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

describe("renderAnalysis contract files", () => {
  it("marks a contract file in the table and takes its changes from the contracts", () => {
    const report = sampleReport();
    const manyCommits = {
      ...report,
      contracts: report.contracts.map((contract) =>
        Object.assign({}, contract, { revisions: 999 }),
      ),
    };
    const couplings = section(plainView(manyCommits), "Change coupling");

    expect(couplings[3]).toBe(
      "   58%      22         2    79%    46%  -        packages/billing/api/billing.tsp (contract) <-> packages/billing/src/invoice.ts",
    );
  });

  it("leaves out pairs of two contract files, like test pairs, and says so in the header", () => {
    const report = sampleReport();
    const siblings = report.couplings.slice(0, 1).map((coupling): Coupling =>
      Object.assign({}, coupling, {
        a: "api/a.tsp",
        b: "api/b.tsp",
        degree: 1,
        kinds: { a: "contract" as const, b: "contract" as const },
      }),
    );
    const extraContracts = report.contracts
      .slice(0, 1)
      .flatMap((contract) =>
        ["api/a.tsp", "api/b.tsp"].map((path) =>
          Object.assign({}, contract, { path }),
        ),
      );
    const crowded: Analysis = {
      ...report,
      contracts: [...report.contracts, ...extraContracts],
      couplings: [...siblings, ...report.couplings],
    };

    const view = plainView(crowded);

    expect(view).toContain(
      "Change coupling (test pairs and contract pairs excluded)",
    );
    expect(view).not.toContain("api/a.tsp");
    expect(section(view, "Change coupling")).toEqual(
      section(plainView(), "Change coupling"),
    );
  });
});

describe("renderAnalysis contract-only partners", () => {
  it("marks a module partner that holds only contract files", () => {
    const report = sampleReport();
    const modules = report.modules.map((module) =>
      module.path === "packages/shared"
        ? Object.assign({}, module, {
            partners: [
              { path: "spec", sharedCommits: 11, contractsOnly: true },
            ],
          })
        : module,
    );

    const table = section(
      plainView({ ...report, modules }),
      "Least cohesive modules",
    );

    expect(table[1]).toBe(
      "     40%       30  packages/shared   spec (contracts) (11)",
    );
  });
});
