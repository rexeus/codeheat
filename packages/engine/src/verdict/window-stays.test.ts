import { describe, expect, it } from "vitest";

import { windowStays } from "./window-stays.js";

const JUDGED = new Set(["t1", "t2"]);

/** `count` changes that each touched `areas`. */
const changes = (count: number, ...areas: ReadonlyArray<string>) =>
  Array.from({ length: count }, () => new Set(areas));

describe("windowStays", () => {
  it("is the share of the changes touching a judged area that touched no other, each change counted once", () => {
    // 11 changes touch a judged area, 6 of them alone; the one in t9 touches none
    const window = [
      ...changes(6, "t1"),
      ...changes(3, "t1", "t2"),
      ...changes(2, "t2", "elsewhere"),
      ...changes(1, "t9"),
    ];

    expect(windowStays(window, JUDGED, 10)).toStrictEqual({
      value: 6 / 11,
      changes: 11,
    });
  });

  it("has no share with fewer changes touching a judged area than a window needs", () => {
    const window = [...changes(9, "t1"), ...changes(5, "t9")];

    expect(windowStays(window, JUDGED, 10)).toBeNull();
  });
});
