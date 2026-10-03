import { describe, expect, it } from "vitest";

import type { Dependencies } from "../imports/dependencies.js";
import type { ModuleRef } from "../modules/detect.js";
import { moduleRecord } from "../testing/module-record.js";
import { dependencyDirection } from "./dependency-direction.js";

const HOMES: ReadonlyMap<string, ModuleRef> = new Map(
  [
    ["stable/a.ts", "stable"],
    ["stable/b.ts", "stable"],
    ["volatile/x.ts", "volatile"],
    ["volatile/y.ts", "volatile"],
    ["steady/s.ts", "steady"],
    ["tests/t.ts", "tests"],
  ].map(([file = "", path = ""]) => [file, { path, kind: "directory" }]),
);

const MODULES = [
  moduleRecord("stable", 4),
  moduleRecord("volatile", 20),
  moduleRecord("steady", 15),
  moduleRecord("tests", 30, true),
];

const loads = (
  entries: Readonly<Record<string, ReadonlyArray<string>>>,
): Dependencies =>
  new Map(Object.entries(entries).map(([file, to]) => [file, new Set(to)]));

const edgesOf = (dependencies: Dependencies, minModuleCommits = 5) =>
  dependencyDirection(dependencies, HOMES, MODULES, minModuleCommits).map(
    ({ from, to, importingFiles }) => `${from} -> ${to} (${importingFiles})`,
  );

describe("dependencyDirection", () => {
  it("flags a module that rarely changes importing one that changes often, counting the importing files", () => {
    const dependencies = loads({
      "stable/a.ts": ["volatile/x.ts", "volatile/y.ts"],
      "stable/b.ts": ["volatile/x.ts"],
    });

    expect(edgesOf(dependencies)).toEqual(["stable -> volatile (2)"]);
  });

  it("explains the edge with the commits of both modules", () => {
    const [edge] = dependencyDirection(
      loads({ "stable/a.ts": ["volatile/x.ts"] }),
      HOMES,
      MODULES,
      5,
    );

    expect(edge).toEqual({
      from: "stable",
      to: "volatile",
      importingFiles: 1,
      fromCommits: 4,
      toCommits: 20,
      reason:
        "1 file of stable, which changed in 4 commits, import volatile, which changed in 20",
    });
  });
});

describe("dependencyDirection exclusions", () => {
  it("does not flag the other direction, or a gap smaller than twice", () => {
    expect(
      edgesOf(
        loads({
          "volatile/x.ts": ["stable/a.ts"],
          "steady/s.ts": ["volatile/x.ts"],
        }),
      ),
    ).toEqual([]);
  });

  it("flags a module that has not changed at all, but not an imported module below the commit floor", () => {
    const silent = [
      ...MODULES,
      moduleRecord("quiet", 0),
      moduleRecord("few", 3),
    ];
    const homes = new Map([
      ...HOMES,
      ["quiet/q.ts", { path: "quiet", kind: "directory" as const }],
      ["few/f.ts", { path: "few", kind: "directory" as const }],
    ]);
    const dependencies = loads({
      "quiet/q.ts": ["volatile/x.ts", "few/f.ts"],
    });

    expect(
      dependencyDirection(dependencies, homes, silent, 5).map(
        ({ from, to }) => `${from} -> ${to}`,
      ),
    ).toEqual(["quiet -> volatile"]);
  });

  it("ignores imports within a module and from or to a test-only module", () => {
    const dependencies = loads({
      "stable/a.ts": ["stable/b.ts"],
      "tests/t.ts": ["stable/a.ts"],
      "volatile/x.ts": ["tests/t.ts"],
      "steady/s.ts": ["tests/t.ts"],
    });

    expect(edgesOf(dependencies)).toEqual([]);
  });

  it("lists the edge with the most importing files first", () => {
    const dependencies = loads({
      "stable/a.ts": ["volatile/x.ts"],
      "steady/s.ts": ["volatile/x.ts"],
      "stable/b.ts": ["volatile/x.ts"],
    });

    expect(
      dependencyDirection(
        dependencies,
        HOMES,
        [...MODULES.slice(0, 2), moduleRecord("steady", 8)],
        5,
      ).map(({ from, importingFiles }) => [from, importingFiles]),
    ).toEqual([
      ["stable", 2],
      ["steady", 1],
    ]);
  });
});
