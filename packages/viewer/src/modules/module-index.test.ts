import { describe, expect, it } from "vitest";

import { fileStats, moduleStats } from "../testing/reports.js";
import { indexModules } from "./module-index.js";

const billing = moduleStats("packages/billing", { cohesion: 0.62 });
const web = moduleStats("packages/web", { cohesion: 0.9 });
const empty = moduleStats("packages/empty", { commits: 0, cohesion: null });

const index = indexModules(
  [
    fileStats("packages/billing/a.ts", { module: "packages/billing" }),
    fileStats("packages/web/b.ts", { module: "packages/web" }),
    fileStats("packages/empty/c.ts", { module: "packages/empty" }),
    fileStats("packages/cut/d.ts", { module: "packages/cut" }),
  ],
  [billing, web, empty],
);

describe("indexModules", () => {
  it("finds the module of a file by the module path the file names", () => {
    expect(index.moduleOf("packages/billing/a.ts")).toBe(billing);
  });

  it("knows no module for a file whose module the report left out", () => {
    expect(index.moduleOf("packages/cut/d.ts")).toBeUndefined();
    expect(index.moduleOf("not/in/the/report.ts")).toBeUndefined();
  });

  it("colors a tile of merged files by the least cohesive module among them", () => {
    expect(
      index.cohesionOf(["packages/web/b.ts", "packages/billing/a.ts"]),
    ).toBe(0.62);
  });

  it("has no cohesion for files whose modules have no data", () => {
    expect(index.cohesionOf(["packages/empty/c.ts"])).toBeNull();
    expect(index.cohesionOf(["packages/cut/d.ts"])).toBeNull();
    expect(index.cohesionOf([])).toBeNull();
  });

  it("skips modules without data when other modules of the tile have some", () => {
    expect(index.cohesionOf(["packages/empty/c.ts", "packages/web/b.ts"])).toBe(
      0.9,
    );
  });
});
