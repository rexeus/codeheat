import { describe, expect, it } from "vitest";

import { randomFrom } from "../testing/seeded-random.js";
import { heatOf } from "./classify-heat.js";
import type { HeatWindow } from "./classify-heat.js";
import { hotFiles } from "./hot-files.js";

const COMPLEXITY = { loc: 40, total: 60, mean: 1.5, max: 4 };

describe("heatOf in a repository whose files all change at the same rate", () => {
  it("finds few acute and few chronic files, since which file is hot is chance", () => {
    const random = randomFrom(7);
    const files = Array.from({ length: 200 }, (_, index) => `src/f${index}.ts`);
    // eight windows; a file has a geometric number of revisions in each, 3 on average
    const windows = Array.from({ length: 8 }, (): HeatWindow => {
      const measures = files.map((path) => ({
        path,
        revisions: 1 + Math.floor(-Math.log(1 - random()) * 2),
        complexity: COMPLEXITY,
      }));
      return {
        active: true,
        touched: new Set(files),
        hot: hotFiles(measures),
      };
    });

    const kinds = files.map((path) => heatOf(path, windows)?.kind);
    const share = (kind: string) =>
      kinds.filter((found) => found === kind).length / files.length;

    expect(share("acute")).toBeLessThan(0.05);
    expect(share("chronic")).toBeLessThan(0.05);
  });
});
