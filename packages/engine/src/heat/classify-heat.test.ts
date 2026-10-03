import { describe, expect, it } from "vitest";

import { heatOf } from "./classify-heat.js";
import type { HeatWindow } from "./classify-heat.js";
import { hotFiles } from "./hot-files.js";

/** Windows in which `FILE` is touched and hot, touched only, or untouched; `quiet` is an inactive window. */
const FILE = "src/a.ts";
const hot: HeatWindow = {
  active: true,
  touched: new Set([FILE]),
  hot: new Set([FILE]),
};
const warm: HeatWindow = { ...hot, hot: new Set() };
const untouched: HeatWindow = { ...warm, touched: new Set() };
const quiet: HeatWindow = { ...hot, active: false, hot: new Set() };

describe("heatOf chronic hotspots", () => {
  it("is chronic when hot in at least half of the windows that count before the last two", () => {
    expect(heatOf(FILE, [hot, hot, hot, warm, warm, warm])).toStrictEqual({
      kind: "chronic",
      hotWindows: 3,
      windows: 6,
    });
    expect(heatOf(FILE, [hot, warm, hot, warm, warm, warm])).toStrictEqual({
      kind: "chronic",
      hotWindows: 2,
      windows: 6,
    });
  });

  it("is chronic when it is still hot in the last two windows", () => {
    expect(heatOf(FILE, [hot, hot, warm, hot, hot, hot])).toStrictEqual({
      kind: "chronic",
      hotWindows: 5,
      windows: 6,
    });
  });

  it("counts a file only from the first window that touched it", () => {
    expect(
      heatOf(FILE, [untouched, untouched, hot, hot, hot, warm, warm]),
    ).toStrictEqual({ kind: "chronic", hotWindows: 3, windows: 5 });
  });

  it("does not count windows without enough changes", () => {
    expect(heatOf(FILE, [hot, quiet, hot, hot, warm, warm])).toStrictEqual({
      kind: "chronic",
      hotWindows: 3,
      windows: 5,
    });
  });

  it("is not chronic when hot in fewer than half of the windows before the last two", () => {
    expect(heatOf(FILE, [hot, warm, warm, warm, warm, warm])).toBeNull();
  });

  it("needs three windows before the last two: being hot lately cannot make a file chronic", () => {
    expect(heatOf(FILE, [hot, hot, warm, warm])).toBeNull();
    expect(heatOf(FILE, [warm, warm, warm, hot, hot])).toStrictEqual({
      kind: "acute",
      hotWindows: 2,
      windows: 5,
    });
  });
});

describe("heatOf acute hotspots", () => {
  it("is acute when hot in both of the last two windows and not before", () => {
    expect(heatOf(FILE, [warm, warm, warm, warm, hot, hot])).toStrictEqual({
      kind: "acute",
      hotWindows: 2,
      windows: 6,
    });
    expect(heatOf(FILE, [untouched, warm, warm, hot, hot])).toStrictEqual({
      kind: "acute",
      hotWindows: 2,
      windows: 4,
    });
  });

  it("is acute in a series of four windows when it became hot in the third", () => {
    // revisions 7, 5, 30, 38 beside nine files with 10 revisions each
    const revisions = [7, 5, 30, 38];
    const others = Array.from({ length: 9 }, (_, index) => `src/o${index}.ts`);
    const windows = revisions.map((count): HeatWindow => ({
      active: true,
      touched: new Set([FILE, ...others]),
      hot: hotFiles(
        [
          { path: FILE, revisions: count },
          ...others.map((path) => ({ path, revisions: 10 })),
        ].map((file) =>
          Object.assign({}, file, {
            complexity: { loc: 40, total: 60, mean: 1.5, max: 4 },
          }),
        ),
      ),
    }));

    expect(heatOf(FILE, windows)).toStrictEqual({
      kind: "acute",
      hotWindows: 2,
      windows: 4,
    });
  });

  it("is neither when it was hot all along in a series too short to call it chronic", () => {
    expect(heatOf(FILE, [hot, hot, hot, hot])).toBeNull();
    expect(heatOf(FILE, [hot, hot, warm, hot, hot])).toStrictEqual({
      kind: "chronic",
      hotWindows: 4,
      windows: 5,
    });
  });

  it("is not acute when hot in only one of the last two windows", () => {
    expect(heatOf(FILE, [warm, warm, warm, warm, warm, hot])).toBeNull();
    expect(heatOf(FILE, [warm, warm, warm, warm, hot, warm])).toBeNull();
  });

  it("is not acute without an active window before the last two: everything would be recent", () => {
    expect(heatOf(FILE, [quiet, quiet, hot, hot])).toBeNull();
    expect(heatOf(FILE, [hot, hot])).toBeNull();
  });
});

describe("heatOf files without heat", () => {
  it("is null for a file no window touched", () => {
    expect(heatOf(FILE, [untouched, untouched, untouched])).toBeNull();
    expect(heatOf(FILE, [])).toBeNull();
  });

  it("is null for a file that was never hot", () => {
    expect(heatOf(FILE, [warm, warm, warm, warm, warm, warm])).toBeNull();
  });
});
