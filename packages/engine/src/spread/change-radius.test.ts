import { describe, expect, it } from "vitest";

import { moduleRecord } from "../testing/module-record.js";
import { measureRadius } from "./change-radius.js";

const touching = (
  ...changes: ReadonlyArray<ReadonlyArray<string>>
): ReadonlyArray<ReadonlySet<string>> =>
  changes.map((modules) => new Set(modules));

const modulesNamed = (...paths: ReadonlyArray<string>) =>
  paths.map((path) => moduleRecord(path, 10));

describe("measureRadius over the repository", () => {
  it("reports the typical change, the spread of nine in ten, and the share that stays in one module", () => {
    // module counts 1 1 1 1 1 1 1 2 2 3: seven of ten stay in one module
    const touched = touching(
      ["a"],
      ["a"],
      ["a"],
      ["b"],
      ["c"],
      ["a"],
      ["b"],
      ["a", "b"],
      ["b", "c"],
      ["a", "b", "c"],
    );

    expect(
      measureRadius(touched, modulesNamed("a", "b", "c")).changeRadius,
    ).toStrictEqual({ changes: 10, median: 1, p90: 2, local: 0.7 });
  });

  it("takes the lower middle value when the number of changes is even", () => {
    const touched = touching(["a"], ["a"], ["a", "b", "c"], ["a", "b", "c"]);

    expect(
      measureRadius(touched, modulesNamed("a", "b", "c")).changeRadius,
    ).toStrictEqual({ changes: 4, median: 1, p90: 3, local: 0.5 });
  });

  it("is a single module wide when every change stays inside one", () => {
    const touched = touching(["a"], ["b"], ["a"]);

    expect(
      measureRadius(touched, modulesNamed("a", "b")).changeRadius,
    ).toStrictEqual({ changes: 3, median: 1, p90: 1, local: 1 });
  });

  it("does not count a change that touched no module", () => {
    const touched = touching(["a"], [], ["a"]);

    expect(
      measureRadius(touched, modulesNamed("a")).changeRadius,
    ).toStrictEqual({ changes: 2, median: 1, p90: 1, local: 1 });
  });

  it("is null when no counted change touched a module", () => {
    expect(measureRadius([], modulesNamed("a")).changeRadius).toBeNull();
    expect(
      measureRadius(touching([]), modulesNamed("a")).changeRadius,
    ).toBeNull();
  });
});

describe("measureRadius per module", () => {
  it("is the median number of modules the changes touching the module touched", () => {
    // a: 1 1 2 2 3 -> 2; b: 2 2 3 -> 2; c: 3 -> 3; d is never touched
    const touched = touching(
      ["a"],
      ["a"],
      ["a", "b"],
      ["a", "b"],
      ["a", "b", "c"],
    );

    expect(
      measureRadius(touched, modulesNamed("a", "b", "c", "d")).modules.map(
        ({ path, radius }) => [path, radius],
      ),
    ).toStrictEqual([
      ["a", 2],
      ["b", 2],
      ["c", 3],
      ["d", null],
    ]);
  });

  it("keeps every other field of the module", () => {
    const [module] = modulesNamed("a");
    const [measured] = measureRadius(
      touching(["a"]),
      modulesNamed("a"),
    ).modules;

    expect(measured).toStrictEqual({ ...module, radius: 1 });
  });
});
