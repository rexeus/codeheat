import { describe, expect, it } from "vitest";

import type { Coupling } from "../model/analysis.js";
import { changeHistory } from "../testing/change-history.js";
import { territoryRecord } from "../testing/territory-record.js";
import type { Level } from "./levels.js";
import { measureLevel } from "./measure-level.js";

/** Four territories: a, b, and d are code, t is test-only, o is a bucket. */
const LEVEL: Level = {
  detail: 2,
  areas: [
    territoryRecord("a", "folder", "r"),
    territoryRecord("b", "package", "r"),
    territoryRecord("d", "folder", "r"),
    territoryRecord("t", "tests", "r"),
    territoryRecord("o", "other", "r"),
  ],
  areaOfFile: new Map([
    ["a/x.ts", "a"],
    ["a/y.ts", "a"],
    ["b/x.ts", "b"],
    ["d/x.ts", "d"],
    ["t/x.test.ts", "t"],
    ["o/x.ts", "o"],
  ]),
};

const measured = (
  changes: ReadonlyArray<ReadonlyArray<string>>,
  couplings: ReadonlyArray<Coupling> = [],
  fixes: ReadonlyArray<number> = [],
) =>
  measureLevel(LEVEL, {
    couplings,
    history: changeHistory(changes, fixes),
    series: [],
    minChanges: 5,
  });

const times = (count: number, ...paths: ReadonlyArray<string>) =>
  Array.from({ length: count }, () => paths);

const coupling = (
  a: string,
  b: string,
  imports: Coupling["imports"],
): Coupling => ({
  a,
  b,
  sharedCommits: 4,
  degree: 0.8,
  distance: 2,
  testPair: false,
  kinds: { a: "code", b: "code" },
  crossesModule: true,
  imports,
});

describe("measureLevel containment and radius", () => {
  it("is the share of the changes touching the territory that touch no other territory", () => {
    const { fits } = measured([
      ...times(6, "a/x.ts"),
      ...times(2, "a/x.ts", "a/y.ts"),
      ...times(2, "a/x.ts", "b/x.ts"),
      ...times(1, "a/y.ts", "b/x.ts", "d/x.ts"),
    ]);

    expect(fits.get("a")).toMatchObject({
      detail: 2,
      containment: 0.7273,
      radius: 1,
    });
    expect(fits.get("b")).toMatchObject({ containment: 0, radius: 2 });
    expect(fits.get("d")).toMatchObject({ containment: 0, radius: 3 });
  });

  it("does not let a test-only territory spread a change or count as one", () => {
    const { fits } = measured([
      ...times(3, "a/x.ts", "t/x.test.ts"),
      ...times(2, "t/x.test.ts"),
    ]);

    expect(fits.get("a")).toMatchObject({ containment: 1, radius: 1 });
    expect(fits.get("t")).toMatchObject({
      containment: null,
      radius: null,
      erosion: null,
      fixDensity: null,
    });
  });

  it("leaves a territory no change touched without containment", () => {
    expect(measured(times(2, "a/x.ts")).fits.get("b")).toMatchObject({
      containment: null,
      radius: null,
    });
  });

  it("ignores a file that belongs to no territory, such as a contract", () => {
    const { fits } = measured(times(4, "a/x.ts", "api/schema.tsp"));

    expect(fits.get("a")).toMatchObject({ containment: 1 });
  });
});

describe("measureLevel partners", () => {
  it("names the territory that shares the most changes, as a share of the territory's own", () => {
    const { fits } = measured([
      ...times(4, "a/x.ts", "b/x.ts"),
      ...times(5, "a/x.ts", "d/x.ts"),
      ...times(3, "a/x.ts"),
      ...times(2, "b/x.ts"),
    ]);

    expect(fits.get("a")?.partner).toStrictEqual({
      territory: "d",
      sharedChanges: 5,
      share: 0.4167,
    });
    expect(fits.get("b")?.partner).toStrictEqual({
      territory: "a",
      sharedChanges: 4,
      share: 0.6667,
    });
    expect(fits.get("d")?.partner).toStrictEqual({
      territory: "a",
      sharedChanges: 5,
      share: 1,
    });
  });

  it("names no partner below three shared changes, for a bucket, or for a territory below the ranking", () => {
    const { fits } = measured([
      ...times(2, "a/x.ts", "b/x.ts"),
      ...times(5, "a/x.ts", "o/x.ts"),
      ...times(4, "d/x.ts", "a/x.ts"),
    ]);

    expect(fits.get("b")?.partner).toBeNull();
    expect(fits.get("o")?.partner).toBeNull();
    expect(fits.get("d")?.partner).toBeNull();
    expect(fits.get("a")?.partner).toBeNull();
  });
});

describe("measureLevel cliques, pairs, and fixes", () => {
  it("counts the cliques a territory belongs to", () => {
    const { fits, cliques } = measured([
      ...times(6, "a/x.ts", "b/x.ts", "d/x.ts"),
      ...times(2, "a/x.ts"),
    ]);

    expect(cliques.map(({ modules }) => modules)).toStrictEqual([
      ["a", "b", "d"],
    ]);
    expect([...fits].map(([id, fit]) => [id, fit.cliques])).toStrictEqual([
      ["a", 1],
      ["b", 1],
      ["d", 1],
      ["t", 0],
      ["o", 0],
    ]);
  });

  it("counts coupled pairs that leave the territory, and those no import links", () => {
    const { fits } = measured(times(1, "a/x.ts"), [
      coupling("a/x.ts", "b/x.ts", "none"),
      coupling("a/x.ts", "d/x.ts", "a→b"),
      coupling("a/x.ts", "a/y.ts", "none"),
      coupling("a/x.ts", "t/x.test.ts", "none"),
      coupling("a/y.ts", "b/x.test.ts", "none"),
    ]);

    expect(fits.get("a")).toMatchObject({ distantPairs: 2, hiddenPairs: 1 });
    expect(fits.get("b")).toMatchObject({ distantPairs: 1, hiddenPairs: 1 });
    expect(fits.get("d")).toMatchObject({ distantPairs: 1, hiddenPairs: 0 });
  });

  it("reads the fix density of the changes that touched the territory", () => {
    const { fits } = measured(
      [...times(4, "a/x.ts"), ...times(2, "a/x.ts", "b/x.ts")],
      [],
      [0, 4],
    );

    expect(fits.get("a")?.fixDensity).toStrictEqual({
      fixes: 2,
      share: 0.3333,
      spanning: 1,
    });
    expect(fits.get("b")?.fixDensity).toStrictEqual({
      fixes: 1,
      share: 0.5,
      spanning: 1,
    });
  });
});

describe("measureLevel erosion", () => {
  it("fits the containment of each window of the series", () => {
    // a keeps 90, 75, 60, 45, 30, and 15 percent of its 40 changes to itself
    const window = (local: number) => ({
      history: changeHistory([
        ...times(local, "a/x.ts"),
        ...times(40 - local, "a/x.ts", "b/x.ts"),
      ]),
    });
    const { fits } = measureLevel(LEVEL, {
      couplings: [],
      history: changeHistory(times(1, "a/x.ts")),
      series: [36, 30, 24, 18, 12, 6].map((local) => window(local)),
      minChanges: 5,
    });

    expect(fits.get("a")?.erosion).toMatchObject({
      verdict: "eroding",
      windows: 6,
      cohesion: [0.9, 0.75, 0.6, 0.45, 0.3, 0.15],
      recent: true,
    });
    expect(fits.get("d")?.erosion).toBeNull();
  });
});
