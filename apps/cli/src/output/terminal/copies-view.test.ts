import type { Report } from "@codeheat/engine";
import { describe, expect, it } from "vitest";

import { sampleReport } from "../../testing/sample-report.js";
import { copyFamilyLine, copyLines } from "./copies-view.js";
import { makeStyle } from "./style.js";

type Family = Report["copyFamilies"][number];

const family = (overrides: Partial<Family> = {}): Family => ({
  files: ["a.ts", "b.ts"],
  similarity: { min: 0.6, max: 0.6 },
  sharedChanges: 5,
  changesToAll: 5,
  testOnly: false,
  ...overrides,
});

const linesOf = (families: Report["copyFamilies"]): ReadonlyArray<string> =>
  copyLines({ ...sampleReport(), copyFamilies: families }, makeStyle(false));

describe("copyLines", () => {
  it("renders the family of the sample report with a note on its counts", () => {
    expect(copyLines(sampleReport(), makeStyle(false))).toEqual([
      "copies  similar  shared  all  files",
      "     2      58%       6    6  packages/auth/src/index.ts, packages/billing/src/index.ts",
      "shared: commits that touched two or more copies; all: commits that touched every copy",
    ]);
  });

  it("is empty without families", () => {
    expect(linesOf([])).toEqual([]);
  });

  it("shows a similarity range when the pairs differ", () => {
    expect(
      linesOf([family({ similarity: { min: 0.55, max: 0.91 } })])[1],
    ).toContain("55-91%");
  });

  it("shows three files and counts the rest", () => {
    const files = ["a.ts", "b.ts", "c.ts", "d.ts", "e.ts"];

    expect(linesOf([family({ files })])[1]).toMatch(
      /a\.ts, b\.ts, c\.ts \+2 more$/u,
    );
  });

  it("lists the five families the report ranks first", () => {
    const families = Array.from({ length: 7 }, (_, index) =>
      family({ files: [`f${index}.ts`, `g${index}.ts`] }),
    );

    expect(linesOf(families)).toHaveLength(7);
    expect(linesOf(families)[5]).toContain("f4.ts, g4.ts");
  });

  it("leaves families of test code only out of the table and counts them", () => {
    const lines = linesOf([
      family({ files: ["src/a.ts", "src/b.ts"] }),
      family({ files: ["test/x.test.ts", "test/y.test.ts"], testOnly: true }),
      family({ files: ["test/p.test.ts", "test/q.test.ts"], testOnly: true }),
    ]);

    expect(lines.slice(1)).toEqual([
      "     2      60%       5    5  src/a.ts, src/b.ts",
      "shared: commits that touched two or more copies; all: commits that touched every copy",
      "2 families of test code only left out; see copyFamilies in --json",
    ]);
  });

  it("says so when only test code has families", () => {
    expect(
      linesOf([
        family({ files: ["test/x.test.ts", "test/y.test.ts"], testOnly: true }),
      ]),
    ).toEqual([
      "1 family of test code only left out; see copyFamilies in --json",
    ]);
  });

  it("escapes terminal control characters in paths", () => {
    const lines = linesOf([family({ files: ["a\u001B[31m.ts", "b.ts"] })]);

    expect(lines.join("\n")).not.toContain("\u001B");
  });
});

describe("copyFamilyLine", () => {
  it("names the other members and how often the family changed together", () => {
    expect(
      copyFamilyLine(
        "b.ts",
        family({
          files: ["a.ts", "b.ts", "c.ts"],
          sharedChanges: 6,
          changesToAll: 4,
        }),
      ),
    ).toEqual([
      "changes with its 2 copies: a.ts, c.ts (6 commits touched at least two of the 3 files, 4 touched all of them)",
    ]);
  });

  it("says one copy for a family of two", () => {
    expect(copyFamilyLine("a.ts", family())).toEqual([
      "changes with its 1 copy: b.ts (5 commits touched both)",
    ]);
  });

  it("says nothing for a file outside every family", () => {
    expect(copyFamilyLine("a.ts", null)).toEqual([]);
  });
});
