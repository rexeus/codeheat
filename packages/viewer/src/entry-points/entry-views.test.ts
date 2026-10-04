import type { Report } from "@codeheat/engine";
import { describe, expect, it } from "vitest";

import { indexTerritories } from "../territories/territory-index.js";
import { boundaryOn, reportWithParts } from "../testing/design-fit.js";
import { entryPointOf, fileStats, reportOf } from "../testing/reports.js";
import {
  entryViewsOf,
  noEntriesNote,
  topEntriesCodeHeat,
} from "./entry-views.js";
import { statsOf } from "./evidence.js";

type EntryPoint = Report["entryPoints"][number];

const viewsOf = (report: Report) =>
  entryViewsOf(report, indexTerritories(report.territories));

const topOf = (report: Report) =>
  topEntriesCodeHeat(report, indexTerritories(report.territories));

const base = reportWithParts([
  { id: "t1", path: "packages/core", heat: 0.4, containment: 0.35 },
  { id: "t2", path: "packages/forms", heat: 0.2, containment: 0.8 },
  { id: "t3", path: "apps/web", heat: 0.15, containment: 0.5 },
  { id: "t4", path: "apps/docs", heat: 0.05, containment: 0.9 },
]);

const withEntries = (...entryPoints: EntryPoint[]): Report => ({
  ...base,
  entryPoints,
});

describe("entryViewsOf a boundary", () => {
  const [view] = viewsOf(withEntries(boundaryOn(1, ["t1"])));

  it("names the territory by the part that tells it apart, with its full path as the title", () => {
    expect(view).toMatchObject({
      rank: 1,
      kind: "boundary",
      kindLabel: "Boundary",
      name: "core",
      title: "packages/core",
    });
  });

  it("splits the design move into its verb phrase and the rest, capitalized", () => {
    expect(view).toMatchObject({
      moveLabel: "Move a boundary",
      move: "Bring what changes together into one territory.",
      verdict: "The boundary does not hold.",
    });
  });

  it("puts the production code's heat of its territory at stake", () => {
    expect(view?.codeHeatShare).toBe(0.12);
  });

  it("shows the boundary's numbers in plain words, most telling first", () => {
    expect(view?.stats).toEqual([
      { value: "35%", label: "of its changes stay inside" },
      { value: "79", label: "file pairs across its edge change together" },
      { value: "10%", label: "of the change effort" },
    ]);
  });
});

describe("entryViewsOf a boundary between two territories", () => {
  it("reads A + B, and counts each territory once", () => {
    const entry = entryPointOf(1, {
      territories: ["t1", "t2", "t1"],
      evidence: { containment: 0.4, sharedChanges: 30, codeHeatShare: 0.55 },
    });

    expect(viewsOf(withEntries(entry))[0]).toMatchObject({
      name: "core + forms",
      title: "packages/core + packages/forms",
      codeHeatShare: 0.55,
    });
  });
});

describe("entryViewsOf the design move", () => {
  it.each([
    [
      "packages/compiler/src/a.ts and b.ts agree.",
      "packages/compiler/src/a.ts and b.ts agree.",
    ],
    ["package.json lists it.", "package.json lists it."],
    ["the files a.ts and b.ts agree.", "The files a.ts and b.ts agree."],
    ["bring it together.", "Bring it together."],
  ])("capitalizes the move %j as %j and never a path", (move, expected) => {
    const report = withEntries(
      entryPointOf(1, {
        kind: "coupling",
        territories: ["t1"],
        designMove: `Centralize a contract: ${move}`,
      }),
    );

    expect(viewsOf(report)[0]?.move).toBe(expected);
  });

  it("falls back to the kind's label for a move without a verb phrase", () => {
    const report = withEntries(
      entryPointOf(1, { kind: "hub", designMove: "Do something." }),
    );

    expect(viewsOf(report)[0]).toMatchObject({
      moveLabel: "Hub",
      move: "Do something.",
    });
  });
});

describe("entryViewsOf entries about files", () => {
  it("names a hub by its file and a coupling by both, with the files' own heat in the code at stake", () => {
    const hub = entryPointOf(1, {
      kind: "hub",
      territories: ["t2"],
      files: ["packages/forms/types.ts"],
      evidence: { fanIn: 48, changedDependents: 47, heatShare: 0.0211 },
    });
    const coupling = entryPointOf(2, {
      kind: "coupling",
      territories: ["t1", "t2"],
      files: ["packages/core/a.ts", "packages/forms/b.ts"],
      evidence: { sharedChanges: 6, degree: 0.3636, heatShare: 0.03 },
    });

    const [hubView, couplingView] = viewsOf(withEntries(hub, coupling));

    expect(hubView).toMatchObject({
      name: "types.ts",
      title: "packages/forms/types.ts",
      kindLabel: "Hub",
      codeHeatShare: 0.0211,
    });
    expect(couplingView).toMatchObject({
      name: "a.ts ↔ b.ts",
      kindLabel: "Hidden coupling",
      codeHeatShare: 0.03,
    });
  });

  it("names a hotspot by its territory, and puts the heat of its chronic hotspots at stake", () => {
    const hotspot = entryPointOf(1, {
      kind: "hotspot",
      territories: ["t3"],
      files: ["apps/web/page.ts"],
      evidence: { chronicHeatShare: 0.05, chronicFiles: 2 },
    });

    expect(viewsOf(withEntries(hotspot))[0]).toMatchObject({
      name: "web",
      codeHeatShare: 0.05,
    });
  });
});

const COMPLEXITY = { total: 50, mean: 1, max: 2 };

/** One code file per territory with the heat `changes × (50 + 50)`, and a hot test file in t1. */
const withHeat = (report: Report): Report => ({
  ...report,
  files: [
    fileStats("packages/core/a.ts", {
      territory: "t1",
      changes: 4,
      loc: 50,
      complexity: COMPLEXITY,
    }),
    fileStats("packages/core/a.spec.ts", {
      territory: "t1",
      test: true,
      changes: 9,
      loc: 950,
      complexity: COMPLEXITY,
    }),
    fileStats("packages/forms/b.ts", {
      territory: "t2",
      changes: 3,
      loc: 50,
      complexity: COMPLEXITY,
    }),
    fileStats("apps/web/c.ts", {
      territory: "t3",
      changes: 2,
      loc: 50,
      complexity: COMPLEXITY,
    }),
    fileStats("apps/docs/d.ts", {
      territory: "t4",
      changes: 1,
      loc: 50,
      complexity: COMPLEXITY,
    }),
  ],
});

describe("topEntriesCodeHeat", () => {
  it("sums the production code's heat in the territories of the top three places, each territory once", () => {
    const report = withHeat(
      withEntries(
        entryPointOf(1, { territories: ["t1", "t2"] }),
        entryPointOf(2, { territories: ["t2"] }),
        entryPointOf(3, { kind: "hub", territories: ["t4"], files: ["x.ts"] }),
        entryPointOf(4, { territories: ["t3"] }),
      ),
    );

    // 400 + 300 + 100 of 1,000 (the test file holds none); web, the fourth place, is left out.
    expect(topOf(report)).toBeCloseTo(0.8);
  });

  it("sums fewer places when there are fewer", () => {
    expect(topOf(withHeat(withEntries(boundaryOn(1, ["t2"]))))).toBeCloseTo(
      0.3,
    );
  });

  it("is null without places to start", () => {
    expect(topOf(base)).toBeNull();
  });
});

describe("statsOf", () => {
  it("leaves out a number the evidence does not have and keeps the kind's order", () => {
    expect(statsOf("hotspot", { fixShare: 0.231, chronicFiles: 5 })).toEqual([
      { value: "5", label: "files hot quarter after quarter" },
      { value: "23%", label: "of its changes are fixes" },
    ]);
  });

  it("shows at most four numbers unless asked for fewer", () => {
    const evidence = {
      containment: 0.3,
      distantPairs: 4,
      heatShare: 0.1,
      hiddenPairs: 2,
      fixShare: 0.2,
    };

    expect(statsOf("boundary", evidence)).toHaveLength(4);
    expect(statsOf("boundary", evidence, 2)).toHaveLength(2);
  });
});

describe("noEntriesNote", () => {
  const judged = reportWithParts([
    { id: "t1", path: "a", heat: 0.5, containment: 0.9 },
  ]);

  it("says nothing stands out for a repository that was judged", () => {
    expect(noEntriesNote(judged)).toBe(
      "Nothing stands out: no place has enough evidence to rank.",
    );
  });

  it("says a window without counted changes has nothing to rank", () => {
    const quiet = { ...judged, window: { ...judged.window, realCommits: 0 } };

    expect(noEntriesNote(quiet)).toBe(
      "No counted changes in this window, so there is nothing to rank; try a longer window with --since.",
    );
  });

  it("tells a report from before territories to analyze again", () => {
    expect(noEntriesNote(reportOf([]))).toBe(
      "This report has no territories or entry points; analyze again with a current codeheat to see where to start.",
    );
  });
});
