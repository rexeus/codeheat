import { describe, expect, it } from "vitest";

import { supportedSubgroups } from "./supported-groups.js";

const commitsOf = (
  count: number,
  ...paths: ReadonlyArray<string>
): ReadonlyArray<ReadonlySet<string>> =>
  Array.from({ length: count }, () => new Set(paths));

/** `count` module names `p0`, `p1`, … in sorted order. */
const packages = (count: number): ReadonlyArray<string> =>
  Array.from(
    { length: count },
    (_, index) => `p${String(index).padStart(3, "0")}`,
  );

describe("supportedSubgroups", () => {
  it("finds the maximal sub-groups that enough changes touched in full, and is not partial", () => {
    const touched = [
      ...commitsOf(5, "a", "b", "c"),
      ...commitsOf(3, "d", "a"),
      ...commitsOf(3, "d", "b"),
    ];

    expect(supportedSubgroups(["a", "b", "c", "d"], touched, 3, 3)).toEqual({
      groups: [["a", "b", "c"]],
      partial: false,
    });
  });

  it("stays fast on many packages that different changes touch in different parts, and says it gave up", () => {
    const group = packages(60);
    let seed = 12345;
    const next = (): number => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed;
    };
    const touched = Array.from(
      { length: 4000 },
      () => new Set(group.filter(() => next() % 100 < 55)),
    );

    const start = performance.now();
    const found = supportedSubgroups(group, touched, 3, 3);
    const seconds = (performance.now() - start) / 1000;

    expect(seconds).toBeLessThan(5);
    expect(found.partial).toBe(true);
  });
});
