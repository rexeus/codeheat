import { describe, expect, it } from "vitest";

import type { CopyFamily } from "../report/copy-family.js";
import type { UnstableInterface } from "../report/unstable-interface.js";
import { copiesEntries } from "./copies.js";
import { hubEntries } from "./hub.js";

const TERRITORIES = new Map([
  ["a/x.ts", "t2"],
  ["b/x.ts", "t3"],
  ["b/y.ts", "t3"],
  ["lib/hub.ts", "t4"],
]);

const family = (overrides: Partial<CopyFamily> = {}): CopyFamily => ({
  files: ["a/x.ts", "b/x.ts"],
  similarity: { min: 0.8, max: 0.9 },
  testOnly: false,
  sharedChanges: 10,
  changesToAll: 8,
  ...overrides,
});

describe("copiesEntries", () => {
  it("scores how often every copy had to take the same edit, among the changes that touched several", () => {
    const [entry] = copiesEntries([family()], TERRITORIES, 200);

    // lockstep 8 / 10, activity 8 / 200
    expect(entry?.score).toBeCloseTo(0.032, 10);
    expect(entry?.kind).toBe("copies");
    expect(entry?.files).toStrictEqual(["a/x.ts", "b/x.ts"]);
    expect(entry?.territories).toStrictEqual(["t2", "t3"]);
    expect(entry?.evidence).toStrictEqual({
      files: 2,
      sharedChanges: 10,
      changesToAll: 8,
      similarity: 0.8,
    });
  });

  it("says what is wrong and what to do", () => {
    const [entry] = copiesEntries([family()], TERRITORIES, 200);

    expect(entry?.verdict).toBe(
      "These files are copies that change in lockstep.",
    );
    expect(entry?.designMove).toBe(
      "Extract a shared abstraction: replace the copies with one shared implementation, or generate them from one source.",
    );
  });

  it("leaves out a family of test code, one that changed together fewer than three times, and a window without changes", () => {
    expect(
      copiesEntries(
        [family({ testOnly: true }), family({ changesToAll: 2 })],
        TERRITORIES,
        200,
      ),
    ).toStrictEqual([]);
    expect(copiesEntries([family()], TERRITORIES, 0)).toStrictEqual([]);
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
  dependents: [],
  reason: "",
  ...overrides,
});

describe("hubEntries", () => {
  it("scores the share of dependents that changed with the file, times its share of all changes", () => {
    const [entry] = hubEntries([hub()], TERRITORIES, 300);

    // ripple 10 / 20, activity 30 / 300
    expect(entry?.score).toBeCloseTo(0.05, 10);
    expect(entry?.kind).toBe("hub");
    expect(entry?.files).toStrictEqual(["lib/hub.ts"]);
    expect(entry?.territories).toStrictEqual(["t4"]);
    expect(entry?.evidence).toStrictEqual({
      fanIn: 20,
      changes: 30,
      medianDependentChanges: 8,
      changedDependents: 10,
    });
  });

  it("says what is wrong and what to do", () => {
    const [entry] = hubEntries([hub()], TERRITORIES, 300);

    expect(entry?.verdict).toBe(
      "Many files depend on this file, and it keeps changing.",
    );
    expect(entry?.designMove).toBe(
      "Break up a hub: split what keeps changing in lib/hub.ts from what many files rely on, so that a change no longer ripples into its dependents.",
    );
  });

  it("leaves out a file that changed with fewer than three of its dependents", () => {
    expect(
      hubEntries([hub({ changedDependents: 2 })], TERRITORIES, 300),
    ).toStrictEqual([]);
  });
});
