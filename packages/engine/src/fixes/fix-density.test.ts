import { describe, expect, it } from "vitest";

import type { LogicalChange } from "../changes/logical-change.js";
import type { SubjectKind } from "../changes/subject-kind.js";
import { moduleRecord } from "../testing/module-record.js";
import { measureFixes } from "./fix-density.js";

/** A change of the given kind that touched `modules`. */
const change = (
  subjectKind: SubjectKind,
  ...modules: ReadonlyArray<string>
): { readonly change: LogicalChange; readonly touched: Set<string> } => ({
  change: { files: new Uint32Array(0), size: 1, subjectKind },
  touched: new Set(modules),
});

const measure = (
  changes: ReadonlyArray<ReturnType<typeof change>>,
  testOnly: ReadonlyArray<string> = [],
) =>
  measureFixes(
    changes.map((entry) => entry.change),
    changes.map((entry) => entry.touched),
    [
      moduleRecord("a", 0),
      moduleRecord("b", 0),
      moduleRecord("idle", 0),
      ...testOnly.map((path) => moduleRecord(path, 0, true)),
    ],
  );

describe("measureFixes of the repository", () => {
  it("counts the fixes among the changes when subjects follow conventions", () => {
    const { fixDensity } = measure([
      change("fix", "a"),
      change("convention", "a"),
      change("convention", "b"),
      change("other", "b"),
    ]);

    expect(fixDensity).toStrictEqual({
      changes: 4,
      fixes: 1,
      conventional: 0.75,
      known: true,
      share: 0.25,
    });
  });

  it("is known when few changes follow a convention but the share is at the threshold", () => {
    // 1 in 20 is 5 %
    const { fixDensity } = measure([
      change("fix", "a"),
      ...Array.from({ length: 19 }, () => change("other", "a")),
    ]);

    expect(fixDensity).toStrictEqual({
      changes: 20,
      fixes: 1,
      conventional: 0.05,
      known: true,
      share: 0.05,
    });
  });

  it("is unknown, not 0, when too few subjects follow a convention", () => {
    // 1 in 21 is below 5 %
    const { fixDensity } = measure([
      change("fix", "a"),
      ...Array.from({ length: 20 }, () => change("other", "a")),
    ]);

    expect(fixDensity).toStrictEqual({
      changes: 21,
      fixes: 1,
      conventional: 0.0476,
      known: false,
      share: null,
    });
  });
});

describe("measureFixes of a repository without a verdict", () => {
  it("is known to be 0 when the team follows conventions and fixes nothing", () => {
    const { fixDensity } = measure([change("convention", "a")]);

    expect(fixDensity).toStrictEqual({
      changes: 1,
      fixes: 0,
      conventional: 1,
      known: true,
      share: 0,
    });
  });

  it("is unknown without changes", () => {
    expect(measure([]).fixDensity).toStrictEqual({
      changes: 0,
      fixes: 0,
      conventional: 0,
      known: false,
      share: null,
    });
  });
});

describe("measureFixes of the modules", () => {
  it("counts per module the fixes among the changes that touched it, and those that span modules", () => {
    const { modules } = measure([
      change("fix", "a"),
      change("fix", "a", "b"),
      change("convention", "a", "b"),
      change("convention", "b"),
    ]);

    expect(
      Object.fromEntries(
        modules.map(({ path, fixDensity }) => [path, fixDensity]),
      ),
    ).toStrictEqual({
      a: { fixes: 2, share: 0.6667, spanning: 1 },
      b: { fixes: 1, share: 0.3333, spanning: 1 },
      idle: null,
    });
  });

  it("does not take a test-only module for a boundary a fix crossed", () => {
    const { modules } = measure(
      [change("fix", "a", "e2e"), change("convention", "a")],
      ["e2e"],
    );

    expect(
      Object.fromEntries(
        modules.map(({ path, fixDensity }) => [path, fixDensity]),
      ),
    ).toStrictEqual({
      a: { fixes: 1, share: 0.5, spanning: 0 },
      b: null,
      idle: null,
      e2e: null,
    });
  });

  it("reports no module while the repository's fix density is unknown", () => {
    const { modules } = measure([change("other", "a"), change("other", "b")]);

    expect(modules.map(({ fixDensity }) => fixDensity)).toStrictEqual([
      null,
      null,
      null,
    ]);
  });
});
