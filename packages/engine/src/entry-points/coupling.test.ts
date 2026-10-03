import { describe, expect, it } from "vitest";

import type { Coupling } from "../report/report.js";
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
  testPair: false,
  kinds: { a: "code", b: "code" },
  crossesModule: true,
  imports: "none",
  ...overrides,
});

const entries = (couplings: ReadonlyArray<Coupling>, changes = 100) =>
  couplingEntries(couplings, AREAS, TERRITORIES, changes);

describe("couplingEntries", () => {
  it("scores how tightly the files change together times the share of all changes that touched both", () => {
    const [entry] = entries([coupling("a/x.ts", "b/x.ts")]);

    // degree 0.6, activity 10 / 100
    expect(entry?.score).toBeCloseTo(0.06, 10);
    expect(entry?.kind).toBe("coupling");
    expect(entry?.files).toStrictEqual(["a/x.ts", "b/x.ts"]);
    expect(entry?.territories).toStrictEqual(["t3", "t5"]);
    expect(entry?.evidence).toStrictEqual({
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
      "Centralize a contract: a/x.ts and b/x.ts agree on something that neither shows to the other; define it once, in a place both use.",
    );
  });

  it("leaves out pairs inside one territory, with an import or an unknown relation, with few shared changes, or with a test", () => {
    expect(
      entries([
        coupling("a/x.ts", "a/y.ts"),
        coupling("a/x.ts", "b/x.ts", { imports: "a→b" }),
        coupling("a/x.ts", "b/y.ts", { imports: null }),
        coupling("a/y.ts", "b/x.ts", { sharedCommits: 4 }),
        coupling("a/y.ts", "b/z.test.ts"),
      ]),
    ).toStrictEqual([]);
  });

  it("leaves out a file that belongs to no territory, and a window without changes", () => {
    expect(entries([coupling("a/x.ts", "api/schema.tsp")])).toStrictEqual([]);
    expect(entries([coupling("a/x.ts", "b/x.ts")], 0)).toStrictEqual([]);
  });

  it("lists only the best of several pairs between the same two territories", () => {
    const listed = entries([
      coupling("a/x.ts", "b/x.ts", { sharedCommits: 6 }),
      coupling("a/y.ts", "b/y.ts", { sharedCommits: 9 }),
      coupling("a/x.ts", "c/x.ts", { sharedCommits: 7 }),
    ]);

    expect(listed.map(({ files }) => files)).toStrictEqual([
      ["a/y.ts", "b/y.ts"],
      ["a/x.ts", "c/x.ts"],
    ]);
  });
});
