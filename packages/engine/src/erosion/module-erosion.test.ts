import { describe, expect, it } from "vitest";

import { moduleRecord } from "../testing/module-record.js";
import { withModuleErosion } from "./module-erosion.js";

/** A window of counted changes, each given as the modules it touched. */
const changes = (
  ...touched: ReadonlyArray<ReadonlyArray<string>>
): ReadonlyArray<ReadonlySet<string>> => touched.map((paths) => new Set(paths));

/** `local` changes that stay in `module` and `shared` that also reach `other`. */
const quarter = (
  module: string,
  local: number,
  shared: number,
  other = "other",
) =>
  changes(
    ...Array.from({ length: local }, () => [module]),
    ...Array.from({ length: shared }, () => [module, other]),
  );

const erosionOf = (
  path: string,
  windows: ReadonlyArray<ReadonlyArray<ReadonlySet<string>>>,
  testOnly = false,
) =>
  withModuleErosion(
    [moduleRecord(path, 10, testOnly), moduleRecord("other", 10)],
    windows,
  ).find((module) => module.path === path)?.erosion;

describe("withModuleErosion", () => {
  it("fits the cohesion of each window through the windows where the module has enough changes", () => {
    // cohesion 0.8, 0.6, 0.4 in windows of 10 changes (the floor is 5)
    const erosion = erosionOf("a", [
      quarter("a", 8, 2),
      quarter("a", 6, 4),
      quarter("a", 4, 6),
    ]);

    expect(erosion).toStrictEqual({
      from: 0.8,
      to: 0.4,
      slope: -0.2,
      windows: 3,
      cohesion: [0.8, 0.6, 0.4],
      recent: true,
    });
  });

  it("leaves out a window where the module had fewer changes than a window of that size needs", () => {
    const erosion = erosionOf("a", [
      quarter("a", 8, 2),
      quarter("a", 1, 2),
      quarter("a", 6, 4),
      quarter("a", 4, 6),
    ]);

    expect(erosion?.cohesion).toStrictEqual([0.8, null, 0.6, 0.4]);
    expect(erosion?.windows).toBe(3);
  });

  it("raises the floor with the window's own changes: 1% of them, at least 5", () => {
    // the busy window counts 700 changes, so a module needs 7 in it; a has 6
    const busy = [...quarter("a", 4, 2), ...quarter("x", 694, 0)];
    const erosion = erosionOf("a", [
      quarter("a", 8, 2),
      quarter("a", 6, 4),
      quarter("a", 4, 6),
      busy,
    ]);

    expect(erosion?.cohesion).toStrictEqual([0.8, 0.6, 0.4, null]);
  });
});

describe("withModuleErosion without evidence", () => {
  it("is no longer recent when the module had no evidence in the last two windows", () => {
    const erosion = erosionOf("a", [
      quarter("a", 8, 2),
      quarter("a", 6, 4),
      quarter("a", 4, 6),
      quarter("x", 10, 0),
      quarter("x", 10, 0),
    ]);

    expect(erosion?.recent).toBe(false);
  });

  it("is null with evidence in fewer than three windows, and for a test-only module", () => {
    expect(erosionOf("a", [quarter("a", 8, 2), quarter("a", 6, 4)])).toBeNull();
    expect(
      erosionOf(
        "a",
        [quarter("a", 8, 2), quarter("a", 6, 4), quarter("a", 4, 6)],
        true,
      ),
    ).toBeNull();
  });

  it("keeps every other field of the module", () => {
    const [module] = withModuleErosion([moduleRecord("a", 10)], []);

    expect(module).toStrictEqual(moduleRecord("a", 10));
  });
});
