import type { Report } from "@codeheat/engine";
import { describe, expect, it } from "vitest";

import { entryViewsOf } from "../entry-points/entry-views.js";
import { indexTerritories } from "../territories/territory-index.js";
import { boundaryOn } from "../testing/design-fit.js";
import { entryPointOf, territoryFit } from "../testing/reports.js";
import { territoryTreeReport } from "../testing/territory-tree.js";
import { cardSourceOf, cardsOf } from "./card-model.js";
import { FACE_FINDINGS } from "./findings.js";
import { indexLevel } from "./level-index.js";

type Fit = NonNullable<Report["territories"]["nodes"][number]["fit"]>;
type Erosion = NonNullable<Fit["erosion"]>;

/** The tree report with `fit` merged into the fit of t3. */
const withFit = (
  fit: Partial<Fit>,
  overrides: Partial<Report> = {},
): Report => {
  const base = territoryTreeReport();
  const nodes = base.territories.nodes.map((node) =>
    node.id === "t3"
      ? Object.assign({}, node, {
          fit: Object.assign({}, node.fit ?? territoryFit(), fit),
        })
      : node,
  );
  return Object.assign({}, base, overrides, {
    territories: { ...base.territories, nodes },
  });
};

const labelsOf = (report: Report, id = "t3"): string[] => {
  const territories = indexTerritories(report.territories);
  const source = cardSourceOf(
    report,
    territories,
    entryViewsOf(report, territories),
  );
  const cards = cardsOf(
    source,
    indexLevel(report.territories, report.files, 2),
  );
  return (
    cards
      .find(({ territory }) => territory.id === id)
      ?.findings.map(({ label }) => label) ?? []
  );
};

const hotspotOn = (rank: number, territories: readonly string[]) =>
  entryPointOf(rank, {
    kind: "hotspot",
    territories,
    findings: [
      {
        kind: "hotspot",
        verdict: "Hot quarter after quarter.",
        designMove: "Split a hotspot: cut it.",
        evidence: { chronicHeatShare: 0.2, chronicFiles: 4 },
        files: [],
      },
    ],
  });

const erosionOf = (verdict: Erosion["verdict"], to: number): Erosion => ({
  verdict,
  from: 0.6,
  to,
  slope: -0.04,
  windows: 8,
  cohesion: [],
  recent: true,
});

/** The tree report where t3 has `fixes` fixes of `share` of its changes, and the repository's share is 30%. */
const withFixes = (fixes: number, share: number): Report =>
  withFit(
    { fixDensity: { fixes, share, spanning: 0 } },
    {
      fixDensity: {
        changes: 100,
        fixes: 30,
        conventional: 0.9,
        known: true,
        share: 0.3,
      },
    },
  );

describe("the findings from a territory's own numbers", () => {
  it("name chronic hotspots, then coupling across its edge", () => {
    expect(labelsOf(withFit({}))).toEqual([
      "Chronic hotspots",
      "Hidden coupling",
    ]);
  });

  it("call an eroding boundary eroding", () => {
    const report = withFit({ erosion: erosionOf("eroding", 0.3) });

    expect(labelsOf(report)[0]).toBe("Eroding");
  });

  it("do not call a boundary eroding that only holds", () => {
    const report = withFit({ erosion: erosionOf("holding", 0.58) });

    expect(labelsOf(report)).not.toContain("Eroding");
  });

  it("call out many fixes only well above the repository's share and from enough changes", () => {
    expect(labelsOf(withFixes(8, 0.6))).toContain("Many fixes");
    expect(labelsOf(withFixes(8, 0.4))).not.toContain("Many fixes");
    expect(labelsOf(withFixes(2, 0.9))).not.toContain("Many fixes");
  });

  it("are left to the places to start for test code and buckets", () => {
    expect(labelsOf(withFit({}), "t6")).toEqual([]);
  });
});

describe("the findings from the places to start", () => {
  it("come first, best rank first", () => {
    const report = withFit(
      {},
      { entryPoints: [hotspotOn(1, ["t3"]), boundaryOn(2, ["t3"])] },
    );

    expect(labelsOf(report).slice(0, 2)).toEqual(["Hotspot", "Boundary"]);
  });

  it("are not repeated in the territory's own words", () => {
    const boundary = withFit({}, { entryPoints: [boundaryOn(1, ["t3"])] });
    const hotspot = withFit({}, { entryPoints: [hotspotOn(1, ["t3"])] });

    expect(labelsOf(boundary)).toEqual(["Boundary", "Chronic hotspots"]);
    expect(labelsOf(hotspot)).toEqual(["Hotspot", "Hidden coupling"]);
  });

  it("are all kept on the card, leaving the choice of the first few to the face", () => {
    const report = withFit(
      {},
      {
        entryPoints: [
          boundaryOn(1, ["t3"]),
          hotspotOn(2, ["t3"]),
          entryPointOf(3, { kind: "hub", territories: ["t3"] }),
          entryPointOf(4, { kind: "copies", territories: ["t3"] }),
        ],
      },
    );

    expect(labelsOf(report).length).toBeGreaterThan(FACE_FINDINGS);
  });
});
