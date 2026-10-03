import type { Report } from "@codeheat/engine";
import { describe, expect, it } from "vitest";

import { territoryLines } from "./territory-view.js";

type Territories = Report["territories"];

const node = (id: string, kind: Territories["nodes"][number]["kind"]) => ({
  id,
  path: id,
  kind,
  parent: null,
  children: [],
  files: 3,
  testFiles: 0,
  changes: 1,
  heatShare: 0,
  description: id,
  splitReason: null,
});

describe("territoryLines", () => {
  it("counts the territories at the recommended detail, leaving buckets, loose files, and test-only code out", () => {
    const territories: Territories = {
      recommended: 2,
      details: [
        { level: 1, ids: ["a"] },
        { level: 2, ids: ["b", "c", "d", "e", "f"] },
        { level: 3, ids: ["b", "c", "d", "e", "g", "h"] },
      ],
      nodes: [
        node("a", "folder"),
        node("b", "package"),
        node("c", "group"),
        node("d", "tests"),
        node("e", "other"),
        node("f", "folder"),
        node("g", "folder"),
        node("h", "folder"),
      ],
    };

    expect(territoryLines({ territories })).toStrictEqual([
      "Territories: 3 at the recommended detail (2 of 3); --json has every detail.",
    ]);
  });

  it("says nothing without territories", () => {
    expect(
      territoryLines({
        territories: { recommended: 0, details: [], nodes: [] },
      }),
    ).toStrictEqual([]);
  });
});
