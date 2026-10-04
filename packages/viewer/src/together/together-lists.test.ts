import { describe, expect, it } from "vitest";

import { indexTerritories } from "../territories/territory-index.js";
import { fileStats, reportOf, territoryNode } from "../testing/reports.js";
import {
  cliqueViews,
  familyViews,
  filePairViews,
  testOnlyFamilies,
} from "./together-lists.js";

const report = reportOf(
  [
    fileStats("core/a.ts", { territory: "t2" }),
    fileStats("web/b.ts", { territory: "t3" }),
    fileStats("misc/c.ts", { territory: "t4" }),
    fileStats("core/z.ts", { territory: "t2" }),
  ],
  [],
  [],
  {
    territories: {
      recommended: 1,
      details: [{ level: 1, ids: ["t2", "t3", "t4"] }],
      nodes: [
        territoryNode("t1", ".", { children: ["t2", "t3", "t4"], fit: null }),
        territoryNode("t2", "core", { parent: "t1" }),
        territoryNode("t3", "web", { parent: "t1" }),
        territoryNode("t4", "misc", { parent: "t1", kind: "other" }),
      ],
    },
    territoryCliques: [
      {
        territories: ["t2", "t3", "gone"],
        sharedChanges: 9,
        weakestShare: 0.4,
        heatShare: 0.25,
        codeHeatShare: 0.2,
      },
    ],
    distantCouplings: [
      {
        a: "core/a.ts",
        b: "web/b.ts",
        sharedCommits: 12,
        strength: 0.6,
        distance: 4,
        crossesModule: true,
        modules: { a: "core", b: "web" },
        imports: "none",
        score: 4,
      },
      {
        a: "core/a.ts",
        b: "core/z.ts",
        sharedCommits: 5,
        strength: 0.3,
        distance: 5,
        crossesModule: true,
        modules: { a: "core", b: "core" },
        imports: null,
        score: 1,
      },
      {
        a: "core/a.ts",
        b: "misc/c.ts",
        sharedCommits: 4,
        strength: 0.3,
        distance: 5,
        crossesModule: false,
        modules: { a: "core", b: "core" },
        imports: null,
        score: 0.5,
      },
    ],
    copyFamilies: [
      {
        files: ["a.ts", "b.ts"],
        similarity: { min: 0.6, max: 0.6 },
        testOnly: false,
        sharedChanges: 7,
        changesToAll: 5,
      },
      {
        files: ["a.test.ts", "b.test.ts"],
        similarity: { min: 0.5, max: 0.9 },
        testOnly: true,
        sharedChanges: 4,
        changesToAll: 3,
      },
    ],
  },
);
const index = indexTerritories(report.territories);

describe("cliqueViews", () => {
  it("names the member territories and the evidence", () => {
    expect(cliqueViews(report, index)).toStrictEqual([
      {
        members: [
          { id: "t2", name: "core" },
          { id: "t3", name: "web" },
        ],
        stats: [
          { value: "9", label: "changes touched all of them" },
          {
            value: "40%",
            label: "of the smaller one's changes in the weakest pair",
          },
          { value: "25%", label: "of the change effort together" },
        ],
      },
    ]);
  });
});

describe("filePairViews", () => {
  const [hidden, near, bucket] = filePairViews(report, index);

  it("says whether an import links the files and how far apart they lie", () => {
    expect(hidden).toMatchObject({
      hidden: true,
      imports: "no import between them",
      apart: "in different territories",
    });
    expect(near).toMatchObject({
      hidden: false,
      imports: "import relation not known",
      apart: "5 folders apart",
    });
    expect(bucket?.apart).toBe("in different territories");
  });

  it("speaks of territories and never of modules, whatever crossesModule says", () => {
    expect(near?.apart).toBe("5 folders apart");
    expect(hidden?.apart).not.toMatch(/module/u);
  });

  it("names the real territory of each file and none for a bucket", () => {
    expect(hidden?.territories).toStrictEqual([
      { id: "t2", name: "core" },
      { id: "t3", name: "web" },
    ]);
    expect(bucket?.territories[1]).toBeNull();
  });

  it("carries the shared changes and the degree", () => {
    expect(hidden?.stats).toStrictEqual([
      { value: "12", label: "shared changes" },
      { value: "60%", label: "coupling degree" },
    ]);
  });
});

describe("familyViews", () => {
  it("lists the families with code and counts those of test code only", () => {
    expect(familyViews(report)).toStrictEqual([
      {
        files: ["a.ts", "b.ts"],
        stats: [
          { value: "60%", label: "alike" },
          { value: "7", label: "changes touched at least two" },
          { value: "5", label: "touched all of them" },
        ],
      },
    ]);
    expect(testOnlyFamilies(report)).toBe(1);
  });
});
