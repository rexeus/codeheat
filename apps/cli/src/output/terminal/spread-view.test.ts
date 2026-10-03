import { describe, expect, it } from "vitest";

import { radiusClause, spreadLines } from "./spread-view.js";

const radiusOf = (changes: number) => ({
  changeRadius: { changes, median: 1, p90: 4, local: 0.6412 },
});

describe("spreadLines", () => {
  it("states the typical change, the spread of nine in ten, and the share that stays in one module", () => {
    expect(spreadLines(radiusOf(170))).toStrictEqual([
      "Across 170 changes, a typical change touches 1 module; 9 in 10 touch at most 4 modules; 64% stay in one module.",
    ]);
  });

  it("leaves out the spread of nine in ten below ten measured changes", () => {
    expect(
      [9, 10].map((changes) => spreadLines(radiusOf(changes))),
    ).toStrictEqual([
      [
        "Across 9 changes, a typical change touches 1 module; 64% stay in one module.",
      ],
      [
        "Across 10 changes, a typical change touches 1 module; 9 in 10 touch at most 4 modules; 64% stay in one module.",
      ],
    ]);
  });

  it("speaks of one change in the singular", () => {
    expect(
      spreadLines({
        changeRadius: { changes: 1, median: 3, p90: 3, local: 0 },
      }),
    ).toStrictEqual([
      "Across 1 change, a typical change touches 3 modules; 0% stay in one module.",
    ]);
  });

  it("says nothing without a change radius", () => {
    expect(spreadLines({ changeRadius: null })).toStrictEqual([]);
  });
});

describe("radiusClause", () => {
  it("continues the module line and is empty without a radius", () => {
    expect(
      [1, 3, null].map((value) => radiusClause({ radius: value })),
    ).toStrictEqual([
      "; a typical change touching it touches 1 module",
      "; a typical change touching it touches 3 modules",
      "",
    ]);
  });
});
