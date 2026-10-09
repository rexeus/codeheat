import { describe, expect, it } from "vitest";

import { fileStats } from "../testing/reports.js";
import { overviewHotspots } from "./overview-hotspots.js";

describe("overviewHotspots", () => {
  it("keeps the report's order and stops at ten files", () => {
    const many = Array.from({ length: 14 }, (_, index) =>
      fileStats(`src/f${index}.ts`),
    );

    expect(overviewHotspots(many).map(({ path }) => path)).toEqual(
      many.slice(0, 10).map(({ path }) => path),
    );
  });
});
