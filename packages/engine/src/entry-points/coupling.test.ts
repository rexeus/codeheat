import { describe, expect, it } from "vitest";

import type { Coupling } from "../model/analysis.js";
import { DEFAULT_THRESHOLDS } from "../testing/report-defaults.js";
import { TENTH_EACH } from "../testing/tenth-heat.js";
import { couplingEntries } from "./coupling.js";

const AREAS = new Map([
  ["a/x.ts", "t2"],
  ["a/y.ts", "t2"],
  ["b/x.ts", "t3"],
  ["b/y.ts", "t3"],
  ["c/x.ts", "t4"],
  ["b/z.test.ts", "t3"],
]);

const TERRITORIES = new Map([
  ["a/x.ts", "t5"],
  ["a/y.ts", "t5"],
  ["b/x.ts", "t3"],
  ["b/y.ts", "t3"],
  ["c/x.ts", "t4"],
]);

const coupling = (
  a: string,
  b: string,
  overrides: Partial<Coupling> = {},
): Coupling => ({
  a,
  b,
  sharedCommits: 10,
  degree: 0.6,
  distance: 2,
  kinds: { a: "code", b: "code" },
  crossesModule: true,
  imports: "none",
  ...overrides,
});

const entries = (
  couplings: ReadonlyArray<Coupling>,
  limits = DEFAULT_THRESHOLDS,
) =>
  couplingEntries(
    couplings,
    { areaOfFile: AREAS, territoryOf: TERRITORIES },
    TENTH_EACH,
    limits,
  );

describe("couplingEntries", () => {
  it("scores the heat of the two files times how tightly they change together", () => {
    const [entry] = entries([coupling("a/x.ts", "b/x.ts")]);

    // heat 2 / 10, degree 0.6
    expect(entry?.score).toBeCloseTo(0.12, 10);
    expect(entry?.kind).toBe("coupling");
    expect(entry?.files).toStrictEqual(["a/x.ts", "b/x.ts"]);
    expect(entry?.territories).toStrictEqual(["t3", "t5"]);
    expect(entry?.evidence).toStrictEqual({
      heatShare: 0.2,
      sharedChanges: 10,
      degree: 0.6,
      distance: 2,
    });
  });

  it("says what is wrong and what to do", () => {
    const [entry] = entries([coupling("a/x.ts", "b/x.ts")]);

    expect(entry?.verdict).toBe(
      "These files keep changing together across territories, and no import links them.",
    );
    expect(entry?.designMove).toBe(
      "Centralize a contract: the files a/x.ts and b/x.ts agree on something that neither shows to the other; define it once, in a place both use.",
    );
  });

  it("leaves out pairs inside one territory, with an import or an unknown relation, or with few shared changes", () => {
    expect(
      entries([
        coupling("a/x.ts", "a/y.ts"),
        coupling("a/x.ts", "b/x.ts", { imports: "a→b" }),
        coupling("a/x.ts", "b/y.ts", { imports: null }),
        coupling("a/y.ts", "b/x.ts", { sharedCommits: 4 }),
      ]),
    ).toStrictEqual([]);
  });

  it("leaves out a file that belongs to no territory", () => {
    expect(entries([coupling("a/x.ts", "api/schema.tsp")])).toStrictEqual([]);
  });

  it("reads the gate on the shared changes from the limits", () => {
    const pair = coupling("a/x.ts", "b/x.ts", { sharedCommits: 4 });

    expect(entries([pair])).toStrictEqual([]);
    expect(
      entries([pair], { ...DEFAULT_THRESHOLDS, minEntryCouplingChanges: 4 }),
    ).toHaveLength(1);
  });

  it("lists only the best of several pairs between the same two territories", () => {
    const listed = entries([
      coupling("a/x.ts", "b/x.ts", { degree: 0.4 }),
      coupling("a/y.ts", "b/y.ts", { degree: 0.8 }),
      coupling("a/x.ts", "c/x.ts", { degree: 0.5 }),
    ]);

    expect(listed.map(({ files }) => files)).toStrictEqual([
      ["a/y.ts", "b/y.ts"],
      ["a/x.ts", "c/x.ts"],
    ]);
  });
});
