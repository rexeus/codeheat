import type { Report } from "@codeheat/engine";
import { describe, expect, it } from "vitest";

import { indexTerritories } from "../territories/territory-index.js";
import { boundaryOn, reportWithParts } from "../testing/design-fit.js";
import { entryPointOf, reportOf } from "../testing/reports.js";
import { entryViewsOf, noEntriesNote, topEntriesHeat } from "./entry-views.js";
import { statsOf } from "./evidence.js";

type EntryPoint = Report["entryPoints"][number];

const viewsOf = (report: Report) =>
  entryViewsOf(report, indexTerritories(report.territories));

const topOf = (report: Report) =>
  topEntriesHeat(report, indexTerritories(report.territories));

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

  it("puts the heat of its evidence at stake", () => {
    expect(view?.heatShare).toBe(0.1);
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
      evidence: { containment: 0.4, sharedChanges: 30 },
    });

    const [view] = viewsOf(withEntries(entry));

    expect(view).toMatchObject({
      name: "core + forms",
      title: "packages/core + packages/forms",
    });
    expect(view?.heatShare).toBeCloseTo(0.6);
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
  it("names a hub by its file and a coupling by both, with the files' own heat at stake", () => {
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
      heatShare: 0.0211,
    });
    expect(couplingView).toMatchObject({
      name: "a.ts ↔ b.ts",
      kindLabel: "Hidden coupling",
      heatShare: 0.03,
    });
  });

  it("names a hotspot by its territory, whose heat is at stake", () => {
    const hotspot = entryPointOf(1, {
      kind: "hotspot",
      territories: ["t3"],
      files: ["apps/web/page.ts"],
      evidence: { chronicHeatShare: 0.05, chronicFiles: 2 },
    });

    expect(viewsOf(withEntries(hotspot))[0]).toMatchObject({
      name: "web",
      heatShare: 0.15,
    });
  });
});

describe("topEntriesHeat", () => {
  it("sums the heat of the territories of the top three places, each territory once", () => {
    const report = withEntries(
      entryPointOf(1, { territories: ["t1", "t2"] }),
      entryPointOf(2, { territories: ["t2"] }),
      entryPointOf(3, { kind: "hub", territories: ["t3"], files: ["x.ts"] }),
      entryPointOf(4, { territories: ["t4"] }),
    );

    // core 40 % + forms 20 % + web 15 %; docs is fourth and left out
    expect(topOf(report)).toBeCloseTo(0.75);
  });

  it("sums fewer places when there are fewer", () => {
    expect(topOf(withEntries(boundaryOn(1, ["t2"])))).toBeCloseTo(0.2);
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
      "Nothing stands out: no territory is both hot enough and leaky enough to be a place to start.",
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
