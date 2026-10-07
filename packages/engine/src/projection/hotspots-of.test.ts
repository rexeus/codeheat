import { describe, expect, it } from "vitest";

import type { FileStats } from "../model/analysis.js";
import type { Territories } from "../model/territory.js";
import { fileRecord } from "../testing/file-record.js";
import { territoryRecord } from "../testing/territory-record.js";
import { hotspotsOf, hottestFiles } from "./hotspots-of.js";

/** The repository split into the folder `app` and a bucket of smaller folders, both at the recommended detail. */
const TERRITORIES: Territories = {
  recommended: 1,
  details: [{ level: 1, ids: ["app", "bucket"] }],
  nodes: [
    territoryRecord("root", "folder", null, ["app", "bucket"]),
    { ...territoryRecord("app", "folder", "root"), path: "src/app" },
    { ...territoryRecord("bucket", "other", "root"), path: "src" },
  ],
};

/** A file of `territory` with `changes` changes and 100 lines of complexity 0: a heat of `changes × 100`. */
const file = (
  path: string,
  changes: number,
  overrides: Partial<FileStats> = {},
): FileStats =>
  fileRecord(path, "app", {
    changes,
    loc: 100,
    complexity: { total: 0, mean: 0, max: 0 },
    ...overrides,
  });

const hotspotsFor = (files: ReadonlyArray<FileStats>) =>
  hotspotsOf(
    hottestFiles({ files, territories: TERRITORIES }),
    (id) => `path of ${id}`,
  );

describe("hotspotsOf", () => {
  it("lists production files by their percent of all the heat, test code counted in the whole", () => {
    const hotspots = hotspotsFor([
      file("src/app/b.ts", 3),
      file("src/app/a.test.ts", 4, { test: true }),
      file("src/app/a.ts", 1, {
        loc: 80,
        complexity: { total: 20, mean: 1, max: 3 },
        heat: { kind: "chronic", hotWindows: 4, windows: 6 },
      }),
      file("src/app/quiet.ts", 0),
    ]);

    expect(hotspots).toEqual([
      {
        path: "src/app/b.ts",
        area: "path of app",
        heat: 37.5,
        changes: 3,
        lines: 100,
        complexity: 0,
        chronic: false,
      },
      {
        path: "src/app/a.ts",
        area: "path of app",
        heat: 12.5,
        changes: 1,
        lines: 80,
        complexity: 20,
        chronic: true,
      },
    ]);
  });

  it("lists at most ten, ties by path", () => {
    const files = Array.from({ length: 12 }, (_, index) =>
      file(`src/app/f${String(index).padStart(2, "0")}.ts`, index < 2 ? 5 : 1),
    );

    expect(hotspotsFor(files.toReversed()).map(({ path }) => path)).toEqual([
      "src/app/f00.ts",
      "src/app/f01.ts",
      ...Array.from({ length: 8 }, (_, index) => `src/app/f0${index + 2}.ts`),
    ]);
  });

  it("names no area for a file outside every real area", () => {
    const [hotspot] = hotspotsFor([
      fileRecord("src/loose.ts", "bucket", { changes: 2 }),
    ]);

    expect(hotspot?.area).toBeNull();
  });
});
