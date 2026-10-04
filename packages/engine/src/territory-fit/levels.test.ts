import { describe, expect, it } from "vitest";

import type { Territories } from "../report/territory.js";
import { territoryRecord } from "../testing/territory-record.js";
import { homeDetails, levelAt } from "./levels.js";

/** Root r splits into a and b; a splits into a1 and a2 at detail 3, b into b1 and b2 at detail 4. */
const territories = (recommended: number): Territories => ({
  recommended,
  details: [
    { level: 1, ids: ["a", "b"] },
    { level: 2, ids: ["a", "b"] },
    { level: 3, ids: ["a1", "a2", "b"] },
    { level: 4, ids: ["a1", "a2", "b1", "b2"] },
  ],
  nodes: [
    territoryRecord("r", "folder", null, ["a", "b"]),
    territoryRecord("a", "folder", "r", ["a1", "a2"]),
    territoryRecord("b", "folder", "r", ["b1", "b2"]),
    territoryRecord("a1", "folder", "a"),
    territoryRecord("a2", "folder", "a"),
    territoryRecord("b1", "folder", "b"),
    territoryRecord("b2", "folder", "b"),
  ],
});

describe("homeDetails", () => {
  it("measures a territory at the detail that shows it closest to the recommended one", () => {
    expect(Object.fromEntries(homeDetails(territories(3)))).toStrictEqual({
      a: 2,
      b: 3,
      a1: 3,
      a2: 3,
      b1: 4,
      b2: 4,
    });
  });

  it("gives the root, which no detail shows, no home", () => {
    expect(homeDetails(territories(3)).has("r")).toBe(false);
  });
});

describe("levelAt", () => {
  const files = new Map([
    ["a/1.ts", "a1"],
    ["a/2.ts", "a2"],
    ["b/1.ts", "b1"],
    ["b/2.ts", "b2"],
  ]);

  it("places every file in the visible territory above its finest one", () => {
    const level = levelAt(territories(3), 3, files);

    expect(level.areas.map(({ id }) => id)).toStrictEqual(["b", "a1", "a2"]);
    expect(Object.fromEntries(level.areaOfFile)).toStrictEqual({
      "a/1.ts": "a1",
      "a/2.ts": "a2",
      "b/1.ts": "b",
      "b/2.ts": "b",
    });
  });

  it("holds every file at the coarsest detail too", () => {
    expect([
      ...levelAt(territories(3), 1, files).areaOfFile.values(),
    ]).toStrictEqual(["a", "a", "b", "b"]);
  });
});
