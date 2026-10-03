import type { Report } from "@codeheat/engine";
import { describe, expect, it } from "vitest";

import { radiusClause, spreadLines } from "./spread-view.js";

const spread = (
  changeRadius: Report["changeRadius"],
  cost: number | null,
): ReadonlyArray<string> =>
  spreadLines({
    changeRadius,
    propagationCost: cost === null ? null : { cost, files: 40 },
    thresholds: { propagationDepth: 3 },
  });

const radius = { changes: 50, median: 1, p90: 4, local: 0.6412 };

describe("spreadLines", () => {
  it("states the typical change, the spread of nine in ten, and the share that stays in one module", () => {
    expect(spread(radius, null)).toStrictEqual([
      "A typical change touches 1 module; 9 in 10 touch at most 4 modules; 64% stay in one module.",
    ]);
  });

  it("names the depth the propagation cost followed", () => {
    expect(spread(null, 0.5)).toStrictEqual([
      "Propagation cost 50%: a change to one file reaches that share of the other files within 3 couplings.",
    ]);
  });

  it("keeps a small cost visible instead of rounding it to nothing", () => {
    expect(
      [0.061, 0.0017, 0.0004, 0, 0.1].map(
        (cost) => spread(null, cost)[0]?.split(":")[0],
      ),
    ).toStrictEqual([
      "Propagation cost 6.1%",
      "Propagation cost 0.2%",
      "Propagation cost <0.1%",
      "Propagation cost 0%",
      "Propagation cost 10%",
    ]);
  });

  it("says nothing without either number", () => {
    expect(spread(null, null)).toStrictEqual([]);
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
