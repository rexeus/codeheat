import { describe, expect, it } from "vitest";

import { fileStats } from "../testing/reports.js";
import { listedHotspotPaths, overviewHotspots } from "./overview-hotspots.js";

const paths = (files: readonly { path: string }[]): string[] =>
  files.map(({ path }) => path);

describe("overviewHotspots", () => {
  const hottestFirst = [
    fileStats("src/a.test.ts", { test: true }),
    fileStats("src/b.ts"),
    fileStats("src/c.spec.ts", { test: true }),
    fileStats("src/d.ts"),
  ];

  it("lists production code only by default, keeping the report's order", () => {
    const listed = overviewHotspots(hottestFirst, false);

    expect(paths(listed.files)).toEqual(["src/b.ts", "src/d.ts"]);
    expect(listed.includesTests).toBe(false);
  });

  it("adds test code when asked to include it", () => {
    const listed = overviewHotspots(hottestFirst, true);

    expect(paths(listed.files)).toEqual([
      "src/a.test.ts",
      "src/b.ts",
      "src/c.spec.ts",
      "src/d.ts",
    ]);
    expect(listed.includesTests).toBe(true);
  });

  it("offers the choice only when the report has both production and test code", () => {
    const productionOnly = [fileStats("src/a.ts"), fileStats("src/b.ts")];
    const testsOnly = [fileStats("src/a.test.ts", { test: true })];

    expect(overviewHotspots(hottestFirst, false).toggleable).toBe(true);
    expect(overviewHotspots(productionOnly, false).toggleable).toBe(false);
    expect(overviewHotspots(testsOnly, false).toggleable).toBe(false);
  });

  it("lists test code when there is nothing else to rank", () => {
    const testsOnly = [
      fileStats("src/a.test.ts", { test: true }),
      fileStats("src/b.test.ts", { test: true }),
    ];

    const listed = overviewHotspots(testsOnly, false);

    expect(paths(listed.files)).toEqual(["src/a.test.ts", "src/b.test.ts"]);
    expect(listed.includesTests).toBe(true);
  });

  it("stops at ten files", () => {
    const many = Array.from({ length: 14 }, (_, index) =>
      fileStats(`src/f${index}.ts`),
    );

    expect(overviewHotspots(many, false).files).toHaveLength(10);
  });

  it("reaches production code behind many hot test files", () => {
    const tests = Array.from({ length: 12 }, (_, index) =>
      fileStats(`src/t${index}.test.ts`, { test: true }),
    );

    const listed = overviewHotspots(
      [...tests, fileStats("src/real.ts")],
      false,
    );

    expect(paths(listed.files)).toEqual(["src/real.ts"]);
  });
});

describe("listedHotspotPaths", () => {
  it("names the files of both lists, each once", () => {
    const hottestFirst = [
      ...Array.from({ length: 10 }, (_, index) =>
        fileStats(`src/t${index}.test.ts`, { test: true }),
      ),
      fileStats("src/real.ts"),
    ];

    const listed = listedHotspotPaths(hottestFirst);

    expect(listed).toContain("src/real.ts");
    expect(listed).toContain("src/t0.test.ts");
    expect(listed).toHaveLength(11);
  });
});
