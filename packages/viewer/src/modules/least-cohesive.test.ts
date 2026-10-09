import { describe, expect, it } from "vitest";

import { moduleStats } from "../testing/reports.js";
import { leastCohesive } from "./least-cohesive.js";

const paths = (modules: readonly { path: string }[]): string[] =>
  modules.map(({ path }) => path);

describe("leastCohesive", () => {
  it("keeps the report order and lists at most five modules", () => {
    const modules = ["f", "e", "d", "c", "b", "a"].map((path) =>
      moduleStats(path),
    );

    expect(paths(leastCohesive(modules, 5))).toEqual(["f", "e", "d", "c", "b"]);
  });

  it("leaves out modules below the commit floor, however incohesive", () => {
    const modules = [
      moduleStats("tiny", { cohesion: 0, commits: 4 }),
      moduleStats("exact", { cohesion: 0.5, commits: 5 }),
      moduleStats("big", { cohesion: 0.6, commits: 50 }),
    ];

    expect(paths(leastCohesive(modules, 5))).toEqual(["exact", "big"]);
  });

  it("never lists a module without data", () => {
    const none = moduleStats("none", { commits: 0, cohesion: null });

    expect(leastCohesive([none], 5)).toEqual([]);
  });
});
