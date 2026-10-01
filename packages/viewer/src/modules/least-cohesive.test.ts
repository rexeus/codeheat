import { describe, expect, it } from "vitest";

import { moduleStats } from "../testing/reports.js";
import { leastCohesive } from "./least-cohesive.js";

const withCohesion = (path: string, cohesion: number | null, commits = 10) =>
  moduleStats(path, { cohesion, commits });

const paths = (modules: readonly { path: string }[]): string[] =>
  modules.map(({ path }) => path);

describe("leastCohesive", () => {
  it("lists the lowest cohesion first and at most five modules", () => {
    const modules = [0.9, 0.2, 0.7, 0.4, 0.5, 0.3, 0.8].map((cohesion) =>
      withCohesion(`m/${cohesion}`, cohesion),
    );

    expect(paths(leastCohesive(modules, 5))).toEqual([
      "m/0.2",
      "m/0.3",
      "m/0.4",
      "m/0.5",
      "m/0.7",
    ]);
  });

  it("leaves out modules below the commit floor, however incohesive", () => {
    const modules = [
      withCohesion("tiny", 0, 4),
      withCohesion("exact", 0.5, 5),
      withCohesion("big", 0.6, 50),
    ];

    expect(paths(leastCohesive(modules, 5))).toEqual(["exact", "big"]);
  });

  it("never lists a module without data", () => {
    expect(leastCohesive([withCohesion("none", null, 10)], 5)).toEqual([]);
  });

  it("breaks ties by path", () => {
    const modules = [withCohesion("b", 0.5), withCohesion("a", 0.5)];

    expect(paths(leastCohesive(modules, 5))).toEqual(["a", "b"]);
  });
});
