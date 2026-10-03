import { describe, expect, it } from "vitest";

import { moduleRecord } from "../testing/module-record.js";
import { moduleCoChange, moduleCouplings } from "./module-co-change.js";

/** `count` commits that each touched exactly `paths`. */
const commitsOf = (
  count: number,
  ...paths: ReadonlyArray<string>
): ReadonlyArray<ReadonlySet<string>> =>
  Array.from({ length: count }, () => new Set(paths));

const MODULES = [
  moduleRecord("core", 10),
  moduleRecord("compiler", 20),
  moduleRecord("cli", 5),
  moduleRecord("tiny", 2),
  moduleRecord("tests", 12, true),
];

describe("moduleCouplings", () => {
  it("reports the commits two modules share and their share of the smaller module's commits", () => {
    const touched = [
      ...commitsOf(6, "core", "compiler"),
      ...commitsOf(4, "core"),
      ...commitsOf(14, "compiler"),
    ];

    expect(moduleCouplings(moduleCoChange(touched, MODULES, 5))).toEqual([
      { a: "compiler", b: "core", sharedCommits: 6, share: 0.6 },
    ]);
  });

  it("leaves out a pair that shares fewer than three commits, however large its share", () => {
    const touched = [
      ...commitsOf(2, "cli", "core"),
      ...commitsOf(3, "cli"),
      ...commitsOf(8, "core"),
    ];

    expect(moduleCouplings(moduleCoChange(touched, MODULES, 5))).toEqual([]);
  });

  it("leaves out modules below the commit floor, test-only modules, and places that are no module", () => {
    const touched = [
      ...commitsOf(5, "tiny", "core"),
      ...commitsOf(5, "tests", "core"),
      ...commitsOf(5, "spec-only-place", "core"),
    ];

    expect(moduleCouplings(moduleCoChange(touched, MODULES, 5))).toEqual([]);
  });

  it("counts every pair of the modules one commit touched", () => {
    const touched = commitsOf(4, "cli", "compiler", "core");

    expect(
      moduleCouplings(moduleCoChange(touched, MODULES, 5)).map(
        ({ a, b, sharedCommits, share }) => [a, b, sharedCommits, share],
      ),
    ).toEqual([
      ["cli", "compiler", 4, 0.8],
      ["cli", "core", 4, 0.8],
      ["compiler", "core", 4, 0.4],
    ]);
  });
});
