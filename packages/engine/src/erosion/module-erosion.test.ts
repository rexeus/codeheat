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
) =>
  withModuleErosion(
    [moduleRecord(path, 10), moduleRecord("other", 10)],
    windows,
  ).find((module) => module.path === path)?.erosion;

/** Five windows of 100 changes whose cohesion falls from 0.8 to 0.4. */
const FALLING = [
  quarter("a", 80, 20),
  quarter("a", 70, 30),
  quarter("a", 60, 40),
  quarter("a", 50, 50),
  quarter("a", 40, 60),
];

describe("withModuleErosion", () => {
  it("fits the cohesion of each window through the windows where the module has enough changes", () => {
    expect(erosionOf("a", FALLING)).toStrictEqual({
      from: 0.8,
      to: 0.4,
      slope: -0.1,
      verdict: "eroding",
      windows: 5,
      cohesion: [0.8, 0.7, 0.6, 0.5, 0.4],
      recent: true,
    });
  });

  it("calls a fall that chance explains holding, as the repository's is", () => {
    // the same fall of 40 points, but of 10 changes a window
    const erosion = erosionOf("a", [
      quarter("a", 8, 2),
      quarter("a", 7, 3),
      quarter("a", 6, 4),
      quarter("a", 5, 5),
      quarter("a", 4, 6),
    ]);

    expect(erosion?.verdict).toBe("holding");
    expect(erosion?.from).toBe(0.8);
  });

  it("calls a fall holding with fewer than five windows, or when one end window made it", () => {
    expect(erosionOf("a", FALLING.slice(0, 4))?.verdict).toBe("holding");
    expect(
      erosionOf("a", [
        ...Array.from({ length: 5 }, () => quarter("a", 80, 20)),
        quarter("a", 20, 80),
      ])?.verdict,
    ).toBe("holding");
  });

  it("calls a rise improving", () => {
    expect(erosionOf("a", FALLING.toReversed())?.verdict).toBe("improving");
  });

  it("calls a flat module holding", () => {
    const flat = quarter("a", 30, 20);

    expect(erosionOf("a", [flat, flat, flat, flat, flat])?.verdict).toBe(
      "holding",
    );
  });

  it("leaves out a window where the module had fewer changes than a ranked module needs, and fewer than ten", () => {
    // 9 changes is above the floor of 5 that ranks a module, but below 10
    const erosion = erosionOf("a", [
      FALLING[0] ?? [],
      quarter("a", 5, 4),
      ...FALLING.slice(1),
    ]);

    expect(erosion?.cohesion).toStrictEqual([0.8, null, 0.7, 0.6, 0.5, 0.4]);
    expect(erosion?.windows).toBe(5);
  });

  it("raises the floor with the window's own changes: 1% of them, at least 10", () => {
    // the busy window counts 1500 changes, so a module needs 15 in it; a has 12
    const busy = [...quarter("a", 8, 4), ...quarter("x", 1488, 0)];
    const erosion = erosionOf("a", [...FALLING, busy]);

    expect(erosion?.cohesion).toStrictEqual([0.8, 0.7, 0.6, 0.5, 0.4, null]);
  });
});

describe("withModuleErosion without evidence", () => {
  it("is no longer recent when the module had no evidence in the last two windows", () => {
    const erosion = erosionOf("a", [
      ...FALLING,
      quarter("x", 50, 0),
      quarter("x", 50, 0),
    ]);

    expect(erosion?.recent).toBe(false);
  });

  it("is null with evidence in fewer than three windows", () => {
    expect(erosionOf("a", FALLING.slice(0, 2))).toBeNull();
  });

  it("keeps every other field of the module", () => {
    const [module] = withModuleErosion([moduleRecord("a", 10)], []);

    expect(module).toStrictEqual(moduleRecord("a", 10));
  });
});
