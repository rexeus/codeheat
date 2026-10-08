import { describe, expect, it } from "vitest";

import type { EntryPoint } from "../model/entry-point.js";
import { entryPointsOfFiles } from "./entry-points-of.js";

const NODES = [
  { id: "r", parent: null },
  { id: "a", parent: "r" },
  { id: "a1", parent: "a" },
  { id: "b", parent: "r" },
];

const entry = (
  rank: number,
  kind: EntryPoint["kind"],
  territories: ReadonlyArray<string>,
  files: ReadonlyArray<string> = [],
): EntryPoint => ({
  rank,
  kind,
  score: 0.1,
  territories,
  files,
  evidence: {},
  verdict: "",
  designMove: "",
  findings: [],
});

const FILES = [
  { path: "a/x.ts", territory: "a" },
  { path: "a/sub/y.ts", territory: "a1" },
  { path: "b/z.ts", territory: "b" },
];

const ranksOf = (
  entries: ReadonlyArray<EntryPoint>,
): Record<string, ReadonlyArray<number>> =>
  Object.fromEntries(
    [...entryPointsOfFiles(FILES, entries, NODES)].map(([path, own]) => [
      path,
      own.map(({ rank }) => rank),
    ]),
  );

describe("entryPointsOfFiles", () => {
  it("puts every file in a territory, below it included, in the entry points of that territory", () => {
    expect(
      ranksOf([entry(1, "boundary", ["a"]), entry(2, "boundary", ["b"])]),
    ).toStrictEqual({ "a/x.ts": [1], "a/sub/y.ts": [1], "b/z.ts": [2] });
  });

  it("puts a file in a clique when it lies in any member", () => {
    expect(ranksOf([entry(1, "clique", ["a1", "b"])])).toStrictEqual({
      "a/x.ts": [],
      "a/sub/y.ts": [1],
      "b/z.ts": [1],
    });
  });

  it("concerns only the named files of a file kind, whatever territory they lie in", () => {
    expect(
      ranksOf([
        entry(1, "hotspot", ["a"], ["a/x.ts"]),
        entry(2, "copies", ["a", "b"], ["a/x.ts", "b/z.ts"]),
      ]),
    ).toStrictEqual({
      "a/x.ts": [1, 2],
      "a/sub/y.ts": [],
      "b/z.ts": [2],
    });
  });

  it("gives a file that belongs to none an empty list", () => {
    expect(ranksOf([])).toStrictEqual({
      "a/x.ts": [],
      "a/sub/y.ts": [],
      "b/z.ts": [],
    });
  });

  it("puts the files of a territory that only a finding names in the entry point too", () => {
    const folded: EntryPoint = {
      ...entry(1, "boundary", ["a"]),
      findings: [
        {
          kind: "clique",
          verdict: "",
          designMove: "",
          evidence: {},
          files: [],
          territories: ["a", "b"],
        },
      ],
    };

    expect(ranksOf([folded])).toStrictEqual({
      "a/x.ts": [1],
      "a/sub/y.ts": [1],
      "b/z.ts": [1],
    });
  });
});
