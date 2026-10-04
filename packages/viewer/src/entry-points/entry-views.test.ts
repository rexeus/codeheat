import type { Report } from "@codeheat/engine";
import { describe, expect, it } from "vitest";

import { indexTerritories } from "../territories/territory-index.js";
import { boundaryOn, reportWithParts } from "../testing/design-fit.js";
import { entryPointOf, fileStats, reportOf } from "../testing/reports.js";
import { entryViewsOf, noEntriesNote } from "./entry-views.js";
import { statsOf } from "./evidence.js";

type EntryPoint = Report["entryPoints"][number];

const viewsOf = (report: Report) =>
  entryViewsOf(report, indexTerritories(report.territories));

const base = reportWithParts([
  {
    id: "t1",
    path: "packages/core",
    heat: 0.4,
    containment: 0.35,
    description: "The core",
  },
  { id: "t2", path: "packages/forms", heat: 0.2, containment: 0.8 },
]);

const withEntries = (...entryPoints: EntryPoint[]): Report => ({
  ...base,
  entryPoints,
});

describe("entryViewsOf a boundary", () => {
  const [view] = viewsOf(withEntries(boundaryOn(1, ["t1"])));

  it("names the territory and what it is, and anchors its card by rank", () => {
    expect(view).toMatchObject({
      rank: 1,
      anchor: "entry-1",
      kind: "boundary",
      kindLabel: "Boundary",
      heading: ["packages/core"],
      shortHeading: "packages/core",
      context: "The core",
    });
  });

  it("splits the design move into its verb phrase and the rest, capitalized", () => {
    expect(view).toMatchObject({
      moveLabel: "Move a boundary",
      move: "Bring what changes together into one territory.",
      verdict: "The boundary does not hold.",
    });
  });

  it("shows the boundary's numbers in plain words, most telling first", () => {
    expect(view?.stats).toEqual([
      { value: "35%", label: "of its changes stay inside" },
      { value: "79", label: "file pairs across its edge change together" },
      { value: "10%", label: "of the change effort" },
    ]);
  });

  it("links the territory on the fit map and offers its hottest files", () => {
    const report = {
      ...withEntries(boundaryOn(1, ["t1"])),
      files: [
        fileStats("packages/forms/a.ts", { territory: "t2" }),
        fileStats("packages/core/hot.ts", { territory: "t1" }),
        fileStats("packages/core/warm.ts", { territory: "t1" }),
      ],
    };

    const [found] = viewsOf(report);

    expect(found?.territories.map(({ id }) => id)).toEqual(["t1"]);
    expect(found?.files).toEqual([
      "packages/core/hot.ts",
      "packages/core/warm.ts",
    ]);
  });
});

const leaking = (partner: string | null): Report => ({
  ...reportWithParts([
    {
      id: "t1",
      path: "packages/core",
      heat: 0.4,
      containment: 0.35,
      partner:
        partner === null
          ? null
          : { territory: partner, sharedChanges: 136, share: 0.544 },
    },
    { id: "t2", path: "packages/forms", heat: 0.2, containment: 0.8 },
  ]),
  entryPoints: [
    boundaryOn(1, ["t1"]),
    entryPointOf(2, { kind: "hotspot", territories: ["t1"] }),
  ],
});

describe("entryViewsOf where a boundary leaks to", () => {
  it("names the territory the boundary changes with most, with the numbers", () => {
    expect(viewsOf(leaking("t2"))[0]?.leaksTo).toEqual({
      name: "packages/forms",
      sharedChanges: 136,
      share: 0.544,
    });
  });

  it("says nothing without a partner, for a territory that is only a hotspot, and for an unknown partner", () => {
    expect(viewsOf(leaking(null))[0]?.leaksTo).toBeNull();
    expect(viewsOf(leaking("t2"))[1]?.leaksTo).toBeNull();
    expect(viewsOf(leaking("t-gone"))[0]?.leaksTo).toBeNull();
  });
});

describe("entryViewsOf other kinds", () => {
  it("heads a hub by its file and a coupling by both, without folders in the short form", () => {
    const hub = entryPointOf(1, {
      kind: "hub",
      territories: ["t2"],
      files: ["packages/forms/types.ts"],
      evidence: {
        fanIn: 48,
        changedDependents: 47,
        changes: 51,
        heatShare: 0.0211,
      },
    });
    const coupling = entryPointOf(2, {
      kind: "coupling",
      territories: ["t1", "t2"],
      files: ["packages/core/a.ts", "packages/forms/b.ts"],
      evidence: { sharedChanges: 6, degree: 0.3636, distance: 10 },
    });

    const [hubView, couplingView] = viewsOf(withEntries(hub, coupling));

    expect(hubView).toMatchObject({
      heading: ["packages/forms/types.ts"],
      shortHeading: "types.ts",
      context: "in packages/forms",
      kindLabel: "Hub",
      subject: "types.ts",
    });
    expect(hubView?.stats.map(({ value }) => value)).toEqual([
      "48",
      "47",
      "51",
      "2%",
    ]);
    expect(couplingView).toMatchObject({
      heading: ["packages/core/a.ts", "packages/forms/b.ts"],
      shortHeading: "a.ts ↔ b.ts",
      context: "in packages/core, packages/forms",
      kindLabel: "Hidden coupling",
      subject: "a.ts ↔ b.ts",
    });
    expect(couplingView?.stats).toEqual([
      { value: "6", label: "changes touched both" },
      { value: "36%", label: "of the rarer file's changes" },
      { value: "10", label: "folders apart" },
    ]);
  });
});

describe("entryViewsOf territories", () => {
  it("names the shared folder of a group once", () => {
    const grouped = reportWithParts([
      {
        id: "t1",
        path: "packages/engine/src/analyze + packages/engine/src/inspect",
        heat: 0.5,
        containment: 0.1,
        kind: "group",
      },
    ]);
    const entry = boundaryOn(1, ["t1"]);

    expect(viewsOf({ ...grouped, entryPoints: [entry] })[0]?.heading).toEqual([
      "packages/engine/src/analyze + inspect",
    ]);
  });

  it("heads a clique by its territories", () => {
    const clique = entryPointOf(1, {
      kind: "clique",
      territories: ["t1", "t2"],
    });

    expect(viewsOf(withEntries(clique))[0]).toMatchObject({
      heading: ["packages/core", "packages/forms"],
      shortHeading: "packages/core + packages/forms",
      context: "2 territories that change as one unit",
    });
  });

  it("counts a territory once when an entry names it and its descendants", () => {
    const entry = entryPointOf(1, { territories: ["t1", "t1", "t2"] });

    expect(
      viewsOf(withEntries(entry))[0]?.territories.map(({ id }) => id),
    ).toEqual(["t1", "t2"]);
  });
});

describe("entryViewsOf findings", () => {
  const both = entryPointOf(1, {
    kind: "boundary",
    territories: ["t1"],
    evidence: { containment: 0.35, chronicFiles: 5 },
    findings: [
      {
        kind: "boundary",
        verdict: "The boundary does not hold.",
        designMove: "Move a boundary: bring it together.",
        evidence: { containment: 0.35 },
        files: [],
        territories: ["t1"],
      },
      {
        kind: "hotspot",
        verdict: "Chronic hotspot.",
        designMove: "Split a hotspot: break up a.ts.",
        evidence: { chronicHeatShare: 0.12, chronicFiles: 5 },
        files: ["packages/core/a.ts", "packages/core/b.ts"],
        territories: ["t1"],
      },
    ],
  });
  const [view] = viewsOf(withEntries(both));

  it("shows the primary finding's numbers and lists the others with theirs", () => {
    expect(view?.stats).toEqual([
      { value: "35%", label: "of its changes stay inside" },
    ]);
    expect(view?.also).toEqual([
      {
        kind: "hotspot",
        kindLabel: "Hotspot",
        subject: "",
        verdict: "Chronic hotspot.",
        stats: [
          { value: "12%", label: "of the change effort is here" },
          { value: "5", label: "files hot quarter after quarter" },
        ],
      },
    ]);
  });

  it("offers the files a finding names when the entry names none", () => {
    expect(view?.files).toEqual(["packages/core/a.ts", "packages/core/b.ts"]);
  });
});

describe("statsOf", () => {
  it("leaves out a number the evidence does not have and keeps the kind's order", () => {
    expect(statsOf("hotspot", { fixShare: 0.231, chronicFiles: 5 })).toEqual([
      { value: "5", label: "files hot quarter after quarter" },
      { value: "23%", label: "of its changes are fixes" },
    ]);
  });

  it("never reads a share above zero as 0%", () => {
    expect(statsOf("hub", { heatShare: 0.002 })).toEqual([
      { value: "<1%", label: "of the change effort" },
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
