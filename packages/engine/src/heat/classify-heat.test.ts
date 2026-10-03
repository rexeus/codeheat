import { describe, expect, it } from "vitest";

import { heatOf } from "./classify-heat.js";
import type { HeatWindow } from "./classify-heat.js";

/** A window in which `file` is touched and hot, touched only, or untouched; `quiet` marks an inactive window. */
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
  it("is chronic when hot in at least half of the windows that count for the file", () => {
    expect(heatOf(FILE, [hot, warm, hot, warm])).toStrictEqual({
      kind: "chronic",
      hotWindows: 2,
      windows: 4,
    });
  });

  it("counts a file only from the first window that touched it", () => {
    expect(heatOf(FILE, [untouched, untouched, hot, hot, warm])).toStrictEqual({
      kind: "chronic",
      hotWindows: 2,
      windows: 3,
    });
  });

  it("does not count windows without enough changes", () => {
    expect(heatOf(FILE, [hot, quiet, quiet, hot, hot])).toStrictEqual({
      kind: "chronic",
      hotWindows: 3,
      windows: 3,
    });
  });

  it("is not chronic when hot in fewer than half of the windows", () => {
    expect(heatOf(FILE, [hot, warm, warm, warm])).toBeNull();
  });

  it("needs three windows that count: two hot ones are no history", () => {
    // hot in both windows that count for it, but only two of them count
    expect(heatOf(FILE, [hot, hot, quiet, quiet])).toBeNull();
  });
});

describe("heatOf acute hotspots", () => {
  it("is acute when hot in the last two windows only, with earlier windows to compare with", () => {
    expect(heatOf(FILE, [untouched, warm, warm, warm, hot, hot])).toStrictEqual(
      { kind: "acute", hotWindows: 2, windows: 5 },
    );
  });

  it("is acute when hot in the last window alone", () => {
    expect(heatOf(FILE, [warm, warm, warm, hot])).toStrictEqual({
      kind: "acute",
      hotWindows: 1,
      windows: 4,
    });
  });

  it("is not acute when it was also hot before the last two windows", () => {
    expect(heatOf(FILE, [hot, warm, warm, warm, warm, hot])).toBeNull();
  });

  it("is not acute without an earlier active window: everything would be recent", () => {
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
    expect(heatOf(FILE, [warm, warm, warm, warm])).toBeNull();
  });
});
