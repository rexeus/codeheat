import type { Module, Report } from "@codeheat/engine";
import { describe, expect, it } from "vitest";

import { sampleReport } from "../../testing/sample-report.js";
import { renderAnalysis } from "./analysis-view.js";
import { makeStyle } from "./style.js";

const shallowest = (report: Report): ReadonlyArray<string> => {
  const lines = renderAnalysis(report, makeStyle(false)).split("\n");
  const start = lines.indexOf("Shallowest modules");
  const end = lines.findIndex((line, index) => index > start && line === "");
  return lines.slice(start + 1, end);
};

const withModules = (
  report: Report,
  change: (module: Module) => Partial<Module>,
): Report => ({
  ...report,
  modules: report.modules.map((module) => ({ ...module, ...change(module) })),
});

/** A depth of 10 lines per export. */
const tied = (exports: number) => ({
  exports,
  implementationLines: exports * 10,
  linesPerExport: 10,
});

describe("renderAnalysis shallowest modules", () => {
  it("lists the ranked modules with a depth, fewest lines per export first", () => {
    // the sample measures shared 13.2895, auth 114.3333 and billing 517.5; web and cli have no entry points
    expect(shallowest(sampleReport())).toEqual([
      "lines/export  exports  lines  module",
      "       13.29       38    505  packages/shared",
      "      114.33        9   1029  packages/auth",
      "       517.5        6   3105  packages/billing",
    ]);
  });

  it("leaves out modules below the commit floor and test-only modules, however shallow", () => {
    const report = withModules(sampleReport(), ({ path }) => ({
      ...(path === "packages/shared" ? { commits: 2 } : {}),
      ...(path === "packages/auth" ? { testOnly: true } : {}),
    }));

    expect(shallowest(report)).toEqual([
      "lines/export  exports  lines  module",
      "       517.5        6   3105  packages/billing",
    ]);
  });

  it("breaks ties by the wider interface, then by path", () => {
    const depths = new Map([
      ["packages/billing", tied(4)],
      ["packages/auth", tied(4)],
      ["packages/shared", tied(7)],
    ]);
    const report = withModules(sampleReport(), ({ path }) => ({
      depth: depths.get(path) ?? null,
    }));

    expect(shallowest(report).map((line) => line.split("  ").at(-1))).toEqual([
      "module",
      "packages/shared",
      "packages/auth",
      "packages/billing",
    ]);
  });

  it("leaves the section out when no ranked module has a depth", () => {
    const report = withModules(sampleReport(), () => ({ depth: null }));

    const view = renderAnalysis(report, makeStyle(false));

    expect(view).not.toContain("Shallowest modules");
    expect(view).not.toContain("measurable depth");
    expect(view).toContain(
      "Leaky interfaces\nNo module has a leaky interface.\n\n",
    );
  });

  it("leaves the section out when the only modules with a depth are below the commit floor", () => {
    const report = withModules(sampleReport(), () => ({ commits: 1 }));

    expect(renderAnalysis(report, makeStyle(false))).not.toContain(
      "Shallowest modules",
    );
  });

  it("escapes control characters in module paths", () => {
    const report = withModules(sampleReport(), ({ path }) =>
      path === "packages/shared" ? { path: "pack\u001B[31mages" } : {},
    );

    const view = renderAnalysis(report, makeStyle(false));

    expect(view).toContain("pack\\u001b[31mages");
    expect(view).not.toContain("\u001B");
  });
});
