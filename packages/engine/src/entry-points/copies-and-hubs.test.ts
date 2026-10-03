import { describe, expect, it } from "vitest";

import type { CopyFamily } from "../report/copy-family.js";
import type { UnstableInterface } from "../report/unstable-interface.js";
import { DEFAULT_THRESHOLDS } from "../testing/report-defaults.js";
import { copiesEntries } from "./copies.js";
import { hubEntries } from "./hub.js";

const TERRITORIES = new Map([
  ["a/x.ts", "t2"],
  ["b/x.ts", "t3"],
  ["b/y.ts", "t3"],
  ["lib/hub.ts", "t4"],
]);

/** Every distinct path holds a tenth of all the heat. */
const tenthEach = (paths: Iterable<string>): number => new Set(paths).size / 10;

const family = (overrides: Partial<CopyFamily> = {}): CopyFamily => ({
  files: ["a/x.ts", "b/x.ts"],
  similarity: { min: 0.8, max: 0.9 },
  testOnly: false,
  sharedChanges: 10,
  changesToAll: 8,
  ...overrides,
});

const copies = (families: ReadonlyArray<CopyFamily>) =>
  copiesEntries(families, TERRITORIES, tenthEach, DEFAULT_THRESHOLDS);

describe("copiesEntries", () => {
  it("scores the heat of the copies times the share of the changes touching several that touched all", () => {
    const [entry] = copies([family()]);

    // heat 2 / 10, lockstep 8 / 10
    expect(entry?.score).toBeCloseTo(0.16, 10);
    expect(entry?.kind).toBe("copies");
    expect(entry?.files).toStrictEqual(["a/x.ts", "b/x.ts"]);
    expect(entry?.territories).toStrictEqual(["t2", "t3"]);
    expect(entry?.evidence).toStrictEqual({
      heatShare: 0.2,
      files: 2,
      sharedChanges: 10,
      changesToAll: 8,
      similarity: 0.8,
    });
  });

  it("says what is wrong and what to do", () => {
    const [entry] = copies([family()]);

    expect(entry?.verdict).toBe(
      "These files are copies that change in lockstep.",
    );
    expect(entry?.designMove).toBe(
      "Extract a shared abstraction: replace the copies with one shared implementation, or generate them from one source.",
    );
  });

  it("leaves out a family of test code and one that changed together fewer than three times", () => {
    expect(
      copies([family({ testOnly: true }), family({ changesToAll: 2 })]),
    ).toStrictEqual([]);
  });

  it("reads the gate from the limits", () => {
    expect(
      copiesEntries([family({ changesToAll: 5 })], TERRITORIES, tenthEach, {
        ...DEFAULT_THRESHOLDS,
        minEntryChanges: 6,
      }),
    ).toStrictEqual([]);
  });
});

const hub = (
  overrides: Partial<UnstableInterface> = {},
): UnstableInterface => ({
  path: "lib/hub.ts",
  module: "lib",
  fanIn: 20,
  changes: 30,
  medianDependentChanges: 8,
  changedDependents: 10,
  dependents: [
    { path: "b/x.ts", sharedCommits: 6 },
    { path: "b/y.ts", sharedCommits: 4 },
  ],
  reason: "",
  ...overrides,
});

const hubs = (interfaces: ReadonlyArray<UnstableInterface>) =>
  hubEntries(interfaces, TERRITORIES, tenthEach, DEFAULT_THRESHOLDS);

describe("hubEntries", () => {
  it("scores the heat of the hub and its listed dependents times the share of its dependents that changed with it", () => {
    const [entry] = hubs([hub()]);

    // heat 3 / 10, ripple 10 / 20
    expect(entry?.score).toBeCloseTo(0.15, 10);
    expect(entry?.kind).toBe("hub");
    expect(entry?.files).toStrictEqual(["lib/hub.ts"]);
    expect(entry?.territories).toStrictEqual(["t4"]);
    expect(entry?.evidence).toStrictEqual({
      heatShare: 0.3,
      fanIn: 20,
      changes: 30,
      medianDependentChanges: 8,
      changedDependents: 10,
    });
  });

  it("says what is wrong and what to do", () => {
    const [entry] = hubs([hub()]);

    expect(entry?.verdict).toBe(
      "Many files depend on this file, and it keeps changing.",
    );
    expect(entry?.designMove).toBe(
      "Break up a hub: split what keeps changing in lib/hub.ts from what many files rely on, so that a change no longer ripples into its dependents.",
    );
  });

  it("leaves out a file that changed with fewer than three of its dependents", () => {
    expect(hubs([hub({ changedDependents: 2 })])).toStrictEqual([]);
  });
});
