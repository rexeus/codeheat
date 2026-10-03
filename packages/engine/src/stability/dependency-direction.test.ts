import { describe, expect, it } from "vitest";

import type { History } from "../history/history.js";
import type { Dependencies } from "../imports/dependencies.js";
import { countKinds } from "../mechanical/kinds.js";
import type { ModuleRef } from "../modules/detect.js";
import { moduleRecord } from "../testing/module-record.js";
import { dependencyDirection } from "./dependency-direction.js";

const PATHS = [
  "stable/a.ts",
  "stable/b.ts",
  "volatile/x.ts",
  "volatile/y.ts",
  "steady/s.ts",
  "tests/t.ts",
  "quiet/q.ts",
  "few/f.ts",
];

const HOMES: ReadonlyMap<string, ModuleRef> = new Map(
  PATHS.map((file) => [
    file,
    { path: file.split("/")[0] ?? ".", kind: "directory" },
  ]),
);

const MODULES = [
  moduleRecord("stable", 4),
  moduleRecord("volatile", 20),
  moduleRecord("steady", 8),
  moduleRecord("tests", 30, true),
  moduleRecord("quiet", 0),
  moduleRecord("few", 3),
];

const loads = (
  entries: Readonly<Record<string, ReadonlyArray<string>>>,
): Dependencies =>
  new Map(Object.entries(entries).map(([file, to]) => [file, new Set(to)]));

/** The changes named, each by the paths it touched. */
const historyOf = (
  ...changes: ReadonlyArray<ReadonlyArray<string>>
): History => ({
  paths: PATHS,
  files: new Map(),
  mechanical: countKinds([]),
  commits: [],
  logicalChanges: { by: "commit", count: changes.length, largest: 1 },
  changes: changes.map((files) => ({
    files: Uint32Array.from(files.map((file) => PATHS.indexOf(file))),
    size: files.length,
  })),
});

const flagged = (dependencies: Dependencies, history = historyOf()) =>
  dependencyDirection({ dependencies, homes: HOMES, history }, MODULES, 5);

const edgesOf = (dependencies: Dependencies, history = historyOf()) =>
  flagged(dependencies, history).map(
    ({ from, to, importingFiles }) => `${from} -> ${to} (${importingFiles})`,
  );

describe("dependencyDirection flags", () => {
  it("flags a module that rarely changes importing one that changes often, counting the importing files", () => {
    const dependencies = loads({
      "stable/a.ts": ["volatile/x.ts", "volatile/y.ts"],
      "stable/b.ts": ["volatile/x.ts"],
    });

    expect(edgesOf(dependencies)).toEqual(["stable -> volatile (2)"]);
  });

  it("explains the edge with the changes of both modules and the importers that changed with what they import", () => {
    const [edge] = flagged(
      loads({ "stable/a.ts": ["volatile/x.ts"] }),
      historyOf(["stable/a.ts", "volatile/x.ts"], ["volatile/x.ts"]),
    );

    expect(edge).toEqual({
      from: "stable",
      to: "volatile",
      importingFiles: 1,
      changesTogether: 1,
      fromCommits: 4,
      toCommits: 20,
      ratio: 5,
      reason:
        "1 file of stable, which changed in 4 changes, import volatile, which changed in 20; an importer changed together with what it imports in 1 change",
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
    ).toEqual(["steady -> volatile (1)"]);
    expect(
      dependencyDirection(
        {
          dependencies: loads({ "steady/s.ts": ["volatile/x.ts"] }),
          homes: HOMES,
          history: historyOf(),
        },
        [moduleRecord("steady", 11), moduleRecord("volatile", 20)],
        5,
      ),
    ).toEqual([]);
  });

  it("flags a module that has not changed at all, but not an imported module below the commit floor", () => {
    const dependencies = loads({
      "quiet/q.ts": ["volatile/x.ts", "few/f.ts"],
    });

    expect(edgesOf(dependencies)).toEqual(["quiet -> volatile (1)"]);
  });

  it("ignores imports within a module and from or to a test-only module", () => {
    const dependencies = loads({
      "stable/a.ts": ["stable/b.ts"],
      "tests/t.ts": ["stable/a.ts"],
      "volatile/x.ts": ["tests/t.ts"],
      "stable/b.ts": ["tests/t.ts"],
    });

    expect(edgesOf(dependencies)).toEqual([]);
  });
});

describe("dependencyDirection ranking", () => {
  const dependencies = loads({
    "stable/a.ts": ["volatile/x.ts"],
    "stable/b.ts": ["volatile/x.ts"],
    "steady/s.ts": ["volatile/y.ts"],
    "quiet/q.ts": ["volatile/x.ts"],
  });

  it("ranks by how much more volatile the imported module is and the importers that changed with it, not by importing files", () => {
    // stable: ratio 5 but no importer ever changed with volatile; steady: ratio 2.5, one importer did.
    const history = historyOf(["steady/s.ts", "volatile/y.ts"]);

    expect(edgesOf(dependencies, history)).toEqual([
      "steady -> volatile (1)",
      "stable -> volatile (2)",
      "quiet -> volatile (1)",
    ]);
  });

  it("puts the edge with the larger ratio first when importers changed with the imported files on both", () => {
    const history = historyOf(
      ["stable/a.ts", "volatile/x.ts"],
      ["stable/b.ts", "volatile/x.ts"],
      ["quiet/q.ts", "volatile/x.ts"],
      ["steady/s.ts", "volatile/y.ts"],
    );

    // stable: log2(5) × log2(3) = 3.7; quiet: log2(20) × log2(2) = 4.3; steady: log2(2.5) × log2(2) = 1.3.
    expect(edgesOf(dependencies, history)).toEqual([
      "quiet -> volatile (1)",
      "stable -> volatile (2)",
      "steady -> volatile (1)",
    ]);
  });
});
