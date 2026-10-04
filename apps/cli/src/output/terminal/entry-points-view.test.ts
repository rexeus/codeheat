import type { Report } from "@codeheat/engine";
import { describe, expect, it } from "vitest";

import { entryPointLines, fileEntryPointLines } from "./entry-points-view.js";
import { makeStyle } from "./style.js";

type EntryPoint = Report["entryPoints"][number];

const entry = (overrides: Partial<EntryPoint>): EntryPoint => {
  const own = {
    kind: "boundary" as const,
    files: [],
    evidence: {},
    verdict: "Verdict.",
    designMove: "Move.",
    ...overrides,
  };
  return {
    rank: 1,
    score: 0.2,
    territories: ["t2"],
    findings: [
      {
        kind: own.kind,
        verdict: own.verdict,
        designMove: own.designMove,
        evidence: own.evidence,
        files: own.files,
        territories: ["t2"],
      },
    ],
    ...own,
  };
};

const territories = (
  paths: Readonly<Record<string, string>>,
): Pick<Report, "territories"> => ({
  territories: {
    recommended: 1,
    details: [],
    nodes: Object.entries(paths).map(([id, path]) => ({
      id,
      path,
      kind: "folder" as const,
      parent: null,
      children: [],
      files: 1,
      testFiles: 0,
      changes: 1,
      heatShare: 0,
      description: path,
      splitReason: null,
      fit: null,
    })),
  },
});

const lines = (entries: ReadonlyArray<EntryPoint>) =>
  entryPointLines(
    {
      entryPoints: entries,
      ...territories({ t2: "billing", t3: "web", t4: "auth" }),
    },
    makeStyle(false),
  );

describe("entryPointLines", () => {
  it("says nothing without entry points", () => {
    expect(lines([])).toStrictEqual([]);
  });

  it("tells a boundary with its numbers in words, the verdict, and the move", () => {
    expect(
      lines([
        entry({
          evidence: {
            codeHeatShare: 0.31,
            containment: 0.36,
            changes: 278,
            partnerShare: 0.49,
          },
        }),
      ]),
    ).toStrictEqual([
      "Where to start",
      "1. boundary  billing",
      "   Verdict.",
      "   31% of the code's heat; 36% of its 278 changes stay inside, 49% also touch its closest partner",
      "   Move.",
      "",
    ]);
  });
});

describe("entryPointLines subjects", () => {
  it("names the files of a file kind and the territories of a unit", () => {
    const subjects = lines([
      entry({}),
      entry({
        rank: 2,
        kind: "hotspot",
        files: ["billing/a.ts", "billing/b.ts"],
        evidence: { chronicHeatShare: 0.4, chronicShare: 0.5, chronicFiles: 2 },
      }),
      entry({
        rank: 3,
        kind: "clique",
        territories: ["t2", "t3", "t4"],
        evidence: {
          codeHeatShare: 0.5,
          sharedChanges: 1,
          territories: 3,
          weakestShare: 0.3,
        },
      }),
      entry({
        rank: 4,
        kind: "copies",
        files: ["a.ts", "b.ts"],
        evidence: { files: 2, similarity: 0.8, changesToAll: 5 },
      }),
      entry({
        rank: 5,
        kind: "hub",
        files: ["lib/hub.ts"],
        evidence: { fanIn: 1, changes: 1, changedDependents: 1 },
      }),
      entry({
        rank: 6,
        kind: "coupling",
        files: ["a/x.ts", "b/y.ts"],
        evidence: { sharedChanges: 9, degree: 0.6 },
      }),
    ]).filter((line) => /^\d\./u.test(line));

    expect(subjects).toStrictEqual([
      "1. boundary  billing",
      "2. hotspot  billing/a.ts, billing/b.ts",
      "3. unit  billing, web, auth",
      "4. copies  a.ts, b.ts",
      "5. hub  lib/hub.ts",
      "6. coupling  a/x.ts <-> b/y.ts",
    ]);
  });
});

describe("entryPointLines words", () => {
  it("reads one change in the singular", () => {
    expect(
      lines([
        entry({
          kind: "clique",
          territories: ["t2", "t3", "t4"],
          evidence: {
            codeHeatShare: 0.5,
            sharedChanges: 1,
            territories: 3,
            weakestShare: 0.3,
          },
        }),
      ])[3],
    ).toBe(
      "   50% of the code's heat; 1 change touched all 3, every pair shares at least 30%",
    );
  });

  it("makes paths safe to print, in the subject and in the sentences", () => {
    const out = lines([
      entry({
        kind: "hub",
        files: ["a\u001B[31m.ts"],
        designMove: "Break up a\u001B[31m.ts",
        verdict: "Bad\u0007",
      }),
    ]).join("\n");

    expect(out).not.toContain("\u001B");
    expect(out).not.toContain("\u0007");
    expect(out).toContain("a\\u001b[31m.ts");
  });
});

describe("entryPointLines layout", () => {
  it("aligns the lines under an entry with its rank when there are ten", () => {
    const out = lines(
      Array.from({ length: 10 }, (_, index) => entry({ rank: index + 1 })),
    );

    expect(out[1]).toBe(" 1. boundary  billing");
    expect(out[2]).toBe("    Verdict.");
    expect(out[37]).toBe("10. boundary  billing");
    expect(out[38]).toBe("    Verdict.");
  });

  it("keeps the folders of a group territory apart from the territories it lists", () => {
    const out = entryPointLines(
      {
        entryPoints: [entry({ territories: ["t2", "t3"] })],
        ...territories({ t2: "a + b", t3: "c" }),
      },
      makeStyle(false),
    );

    expect(out[1]).toBe("1. boundary  a + b, c");
  });

  it("says which dependents changed with a hub", () => {
    const out = lines([
      entry({
        kind: "hub",
        files: ["lib/hub.ts"],
        evidence: { fanIn: 30, changes: 8, changedDependents: 14 },
      }),
    ]);

    expect(out[3]).toBe(
      "   30 files depend on it, 14 of them changed together with it; 8 changes touched it",
    );
  });
});

describe("entries with two findings", () => {
  const both = entry({
    evidence: {
      codeHeatShare: 0.4,
      containment: 0.5,
      changes: 30,
      chronicShare: 0.6,
      chronicFiles: 2,
    },
    findings: [
      {
        kind: "boundary",
        verdict: "Leaks.",
        designMove: "Move it.",
        evidence: { codeHeatShare: 0.4, containment: 0.5, changes: 30 },
        files: [],
        territories: ["t2"],
      },
      {
        kind: "hotspot",
        verdict: "Chronic.",
        designMove: "Split it.",
        evidence: { chronicHeatShare: 0.3, chronicShare: 0.6, chronicFiles: 2 },
        files: ["a/hot.ts"],
        territories: ["t2"],
      },
    ],
  });

  it("prints the further finding under the entry as also", () => {
    expect(lines([both]).slice(1, 8)).toStrictEqual([
      "1. boundary  billing",
      "   Verdict.",
      "   40% of the code's heat; 50% of its 30 changes stay inside",
      "   Move.",
      "   Also hotspot: Chronic.",
      "   30% of the code's heat sits in 2 chronic hotspots",
      "   Split it.",
    ]);
  });

  it("names the territories, not the hotspot files, when the primary finding is the hotspot", () => {
    const hotspotFirst = entry({ kind: "hotspot", files: [] });

    expect(lines([hotspotFirst])[1]).toBe("1. hotspot  billing");
  });

  it("lists the further finding of an entry in inspect", () => {
    expect(fileEntryPointLines([both])).toStrictEqual([
      "entry point #1 (boundary): Verdict.",
      "  Move.",
      "  also hotspot: Chronic.",
      "  Split it.",
    ]);
  });
});

describe("fileEntryPointLines", () => {
  it("names the rank, kind, verdict, and move of each entry point", () => {
    expect(
      fileEntryPointLines([
        entry({ rank: 2, kind: "hub" }),
        entry({ rank: 5, kind: "copies", verdict: "V.", designMove: "M." }),
      ]),
    ).toStrictEqual([
      "entry point #2 (hub): Verdict.",
      "  Move.",
      "entry point #5 (copies): V.",
      "  M.",
    ]);
  });

  it("says nothing for a file that is in none", () => {
    expect(fileEntryPointLines([])).toStrictEqual([]);
  });
});
