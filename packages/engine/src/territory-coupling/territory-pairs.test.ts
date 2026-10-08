import { describe, expect, it } from "vitest";

import type { Coupling } from "../model/analysis.js";
import type { Territory } from "../model/territory.js";
import type { Level } from "../territory-fit/levels.js";
import { measureLevel } from "../territory-fit/measure-level.js";
import { changeHistory } from "../testing/change-history.js";
import { territoryRecord } from "../testing/territory-record.js";
import { territoryPairs } from "./territory-pairs.js";

/** A territory with `heat` as its share, in a folder named like it. */
const area = (
  id: string,
  heat: number,
  kind: Territory["kind"] = "folder",
): Territory => ({ ...territoryRecord(id, kind, "r"), heatShare: heat });

const levelOf = (areas: ReadonlyArray<Territory>): Level => ({
  detail: 2,
  areas,
  areaOfFile: new Map(areas.map(({ id }) => [`${id}/x.ts`, id])),
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

const pairsOf = (
  areas: ReadonlyArray<Territory>,
  changes: ReadonlyArray<ReadonlyArray<string>>,
  couplings: ReadonlyArray<Coupling> = [],
) => {
  const level = levelOf(areas);
  const { coChange, crossings } = measureLevel(level, {
    couplings,
    history: changeHistory(changes),
    series: [],
    minChanges: 5,
  });
  return territoryPairs(level.areas, coChange, crossings);
};

const REAL = [area("a", 0.4), area("b", 0.3), area("d", 0.2)];

describe("territoryPairs", () => {
  it("lists each pair once, lower id first, with the changes it shares, strongest first", () => {
    const pairs = pairsOf(REAL, [
      ...times(4, "d/x.ts", "a/x.ts"),
      ...times(6, "b/x.ts", "a/x.ts"),
      ...times(3, "d/x.ts", "b/x.ts"),
    ]);

    expect(pairs).toStrictEqual([
      { a: "a", b: "b", sharedChanges: 6, distantPairs: 0, hiddenPairs: 0 },
      { a: "a", b: "d", sharedChanges: 4, distantPairs: 0, hiddenPairs: 0 },
      { a: "b", b: "d", sharedChanges: 3, distantPairs: 0, hiddenPairs: 0 },
    ]);
  });

  it("counts the coupled file pairs between the two territories, and those no import links", () => {
    const pairs = pairsOf(REAL, times(5, "a/x.ts", "b/x.ts"), [
      coupling("b/x.ts", "a/x.ts", "none"),
      coupling("a/x.ts", "b/x.ts", "a→b"),
      coupling("a/x.ts", "d/x.ts", "none"),
      coupling("a/x.ts", "a/y.ts", "none"),
    ]);

    expect(pairs).toStrictEqual([
      { a: "a", b: "b", sharedChanges: 5, distantPairs: 2, hiddenPairs: 1 },
    ]);
  });

  it("leaves out pairs below three shared changes, buckets, test code, and territories below the ranking", () => {
    const pairs = pairsOf(
      [...REAL, area("o", 0.5, "other"), area("t", 0.5, "tests")],
      [
        ...times(2, "a/x.ts", "b/x.ts"),
        ...times(5, "a/x.ts", "o/x.ts"),
        ...times(5, "a/x.ts", "t/x.ts"),
        ...times(4, "a/x.ts", "d/x.ts"),
      ],
    );

    expect(pairs.map(({ a, b }) => `${a}-${b}`)).toStrictEqual([]);
  });
});

describe("territoryPairs and partners", () => {
  it("keeps a territory's partner among its pairs, with the same count", () => {
    const changes = [
      ...times(4, "a/x.ts", "b/x.ts"),
      ...times(5, "a/x.ts", "d/x.ts"),
      ...times(3, "a/x.ts"),
      ...times(2, "b/x.ts"),
    ];
    const level = levelOf(REAL);
    const { fits } = measureLevel(level, {
      couplings: [],
      history: changeHistory(changes),
      series: [],
      minChanges: 5,
    });
    const pairs = pairsOf(REAL, changes);

    for (const { id } of REAL) {
      const partner = fits.get(id)?.partner;
      expect(partner).not.toBeNull();
      const pair = pairs.find(
        ({ a, b }) =>
          [a, b].includes(id) && [a, b].includes(partner?.territory ?? ""),
      );
      expect(pair?.sharedChanges).toBe(partner?.sharedChanges);
    }
  });
});

describe("territoryPairs of many territories", () => {
  it("covers the 24 hottest real territories and no more, ties to the lower id", () => {
    const ids = Array.from(
      { length: 27 },
      (_, index) => `t${String(index).padStart(2, "0")}`,
    );
    // t00 is the hottest; t24, t25, and t26 tie for the coolest
    const areas = ids.map((id, index) =>
      area(id, index >= 24 ? 0.001 : 0.05 - index * 0.001),
    );
    const pairs = pairsOf(
      areas,
      ids.flatMap((id) => times(5, `${id}/x.ts`, "t00/x.ts")).slice(5),
    );

    const members = new Set(pairs.flatMap(({ a, b }) => [a, b]));
    expect(members.size).toBe(24);
    expect(members.has("t23")).toBe(true);
    expect(members.has("t24")).toBe(false);
    expect(pairs).toHaveLength(23);
    expect(pairs.every(({ a, b }) => a < b)).toBe(true);
  });

  it("breaks a tie for the 24th place by id", () => {
    const ids = Array.from(
      { length: 25 },
      (_, index) => `t${String(index).padStart(2, "0")}`,
    );
    const pairs = pairsOf(
      ids.map((id) => area(id, 0.04)),
      ids.flatMap((id) => times(5, `${id}/x.ts`, "t00/x.ts")).slice(5),
    );

    const members = new Set(pairs.flatMap(({ a, b }) => [a, b]));
    expect(members.has("t23")).toBe(true);
    expect(members.has("t24")).toBe(false);
  });
});
