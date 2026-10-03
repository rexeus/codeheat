import type { Report } from "@codeheat/engine";
import { describe, expect, it } from "vitest";

import { sampleReport } from "../../testing/sample-report.js";
import { stabilitySections } from "./stability-view.js";
import { makeStyle } from "./style.js";

const direction = (report: Report) => {
  const [edge] = report.dependencyDirection;
  return edge === undefined ? [] : [edge];
};

describe("stabilitySections", () => {
  it("tabulates the unstable interfaces and lists the stable-to-volatile imports", () => {
    expect(stabilitySections(sampleReport(), makeStyle(false))).toEqual([
      "Unstable interfaces (many files import them, and they keep changing)",
      "fan-in  changes  ripple  file",
      "    14       22       9  packages/shared/src/config.ts",
      "fan-in: files that import it; ripple: of those, files that changed in the same change",
      "",
      "Dependency direction (modules that rarely change import ones that change often)",
      "packages/shared (30 changes) imports packages/billing (74 changes) in 2 files; changed together in 1 change",
      "",
    ]);
  });

  it("has no lines for what the report lacks", () => {
    const report = {
      ...sampleReport(),
      unstableInterfaces: [],
      dependencyDirection: [],
    };

    expect(stabilitySections(report, makeStyle(false))).toEqual([]);
  });

  it("counts the imports beyond the first three and says one file in the singular", () => {
    const base = sampleReport();
    const [edge] = direction(base);
    const report = {
      ...base,
      dependencyDirection:
        edge === undefined
          ? []
          : Array.from({ length: 5 }, () => ({ ...edge, importingFiles: 1 })),
    };

    const lines = stabilitySections(report, makeStyle(false));

    expect(lines.at(-3)).toContain("in 1 file");
    expect(lines.at(-2)).toBe("+2 more; see dependencyDirection in --json");
  });

  it("says one change in the singular", () => {
    const base = sampleReport();
    const [edge] = base.dependencyDirection;
    const report = {
      ...base,
      dependencyDirection:
        edge === undefined ? [] : [{ ...edge, fromCommits: 1, toCommits: 4 }],
    };

    expect(stabilitySections(report, makeStyle(false)).join("\n")).toContain(
      "packages/shared (1 change) imports packages/billing (4 changes) in 2 files; changed together in 1 change",
    );
  });

  it("escapes control characters in paths", () => {
    const base = sampleReport();
    const [found] = base.unstableInterfaces;
    const report = {
      ...base,
      unstableInterfaces:
        found === undefined ? [] : [{ ...found, path: "a\u001B[2Jb" }],
    };

    expect(
      stabilitySections(report, makeStyle(false)).join("\n"),
    ).not.toContain("\u001B");
  });
});
