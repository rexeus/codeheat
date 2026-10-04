import type { Report } from "@codeheat/engine";
import { describe, expect, it } from "vitest";

import { fitTilesOf } from "../fit-map/fit-tiles.js";
import { indexTerritories } from "../territories/territory-index.js";
import { reportWithParts } from "../testing/design-fit.js";
import { entryPointOf } from "../testing/reports.js";
import { cardAt } from "../testing/territory-cards.js";
import { territoryTreeReport } from "../testing/territory-tree.js";
import { entryViewsOf } from "./entry-views.js";

type Finding = Report["entryPoints"][number]["findings"][number];

const finding = (
  territories: readonly string[],
  verdict: string,
  evidence: Readonly<Record<string, number>>,
): Finding => ({
  kind: "boundary",
  verdict,
  designMove: "Move a boundary: redraw it.",
  evidence,
  files: [],
  territories,
});

const BETWEEN = "The boundary between core and forms does not hold.";

const report = reportWithParts(
  [
    { id: "t1", path: "packages/core", heat: 0.4, containment: 0.3 },
    { id: "t2", path: "packages/forms", heat: 0.2, containment: 0.4 },
    { id: "t3", path: "packages/docs", heat: 0.1, containment: 0.9 },
  ],
  {
    entryPoints: [
      entryPointOf(1, {
        kind: "boundary",
        territories: ["t1", "t2"],
        evidence: {
          containment: 0.33,
          sharedChanges: 12,
          partnerShare: 0.25,
          heatShare: 0.6,
        },
        verdict: BETWEEN,
        designMove: "Move a boundary: redraw the boundary between them.",
        findings: [
          finding(["t1", "t2"], BETWEEN, {
            containment: 0.33,
            sharedChanges: 12,
          }),
          finding(["t1"], "Core leaks.", { containment: 0.3 }),
          finding(["t2"], "Forms leaks.", { containment: 0.4 }),
        ],
      }),
    ],
  },
);
const index = indexTerritories(report.territories);
const [view] = entryViewsOf(report, index);

describe("entryViewsOf a boundary between two territories", () => {
  it("names both territories and says they leak into each other", () => {
    expect(view).toMatchObject({
      kind: "boundary",
      heading: ["packages/core", "packages/forms"],
      shortHeading: "packages/core + packages/forms",
      context: "2 territories that leak into each other",
      leaksTo: {
        name: "packages/core and packages/forms",
        sharedChanges: 12,
        share: 0.25,
        mutual: true,
      },
    });
    expect(view?.territories.map(({ id }) => id)).toEqual(["t1", "t2"]);
  });

  it("shows how many changes touched both among its numbers", () => {
    expect(view?.stats).toContainEqual({
      value: "12",
      label: "changes touched both territories",
    });
  });

  it("says which territory each further finding is about", () => {
    expect(
      view?.also.map(({ verdict, about }) => [
        verdict,
        about.map(({ id }) => id),
      ]),
    ).toEqual([
      ["Core leaks.", ["t1"]],
      ["Forms leaks.", ["t2"]],
    ]);
  });
});

/** What the first place to start says on the card of territory `id` at detail `level` of `of`. */
const verdictsOn = (of: Report, level: number, id: string) =>
  cardAt(of, level, id)
    .findings.filter(({ rank }) => rank === 1)
    .map(({ verdict }) => verdict);

describe("a boundary between two territories on the fit map and the cards", () => {
  it("marks both tiles with its rank", () => {
    const tiles = fitTilesOf(
      index,
      entryViewsOf(report, index),
      report.thresholds,
    );

    expect(tiles.map(({ id, ranks }) => [id, ranks])).toEqual([
      ["t1", [1]],
      ["t2", [1]],
      ["t3", []],
    ]);
  });

  it("puts the entry on the card of each territory, with that territory's own boundary and not the other's", () => {
    expect(verdictsOn(report, 1, "t1")).toEqual([BETWEEN, "Core leaks."]);
    expect(verdictsOn(report, 1, "t2")).toEqual([BETWEEN, "Forms leaks."]);
    expect(verdictsOn(report, 1, "t3")).toEqual([]);
  });
});

const CLIQUE_VERDICT = "The three change as one unit.";

/** The boundary between `t1` and `t2` that took in the clique of `t1`, `t2`, and `t3`. */
const folded = reportWithParts(
  [
    { id: "t1", path: "packages/core", heat: 0.4, containment: 0.3 },
    { id: "t2", path: "packages/forms", heat: 0.2, containment: 0.4 },
    { id: "t3", path: "packages/docs", heat: 0.1, containment: 0.9 },
  ],
  {
    entryPoints: [
      entryPointOf(1, {
        kind: "boundary",
        territories: ["t1", "t2"],
        evidence: { containment: 0.33, sharedChanges: 12, partnerShare: 0.25 },
        verdict: BETWEEN,
        designMove: "Move a boundary: redraw the boundary between them.",
        findings: [
          finding(["t1", "t2"], BETWEEN, { sharedChanges: 12 }),
          {
            ...finding(["t1", "t2", "t3"], CLIQUE_VERDICT, {}),
            kind: "clique",
          },
        ],
      }),
    ],
  },
);
const foldedIndex = indexTerritories(folded.territories);
const [foldedView] = entryViewsOf(folded, foldedIndex);

describe("a boundary between two territories that took in a clique of a third", () => {
  it("names only the two in its heading, and all three among the territories it touches", () => {
    expect(foldedView?.heading).toEqual(["packages/core", "packages/forms"]);
    expect(foldedView?.touched.map(({ id }) => id)).toEqual(["t1", "t2", "t3"]);
  });

  it("marks the tile of the third territory too", () => {
    const tiles = fitTilesOf(
      foldedIndex,
      entryViewsOf(folded, foldedIndex),
      folded.thresholds,
    );

    expect(tiles.map(({ id, ranks }) => [id, ranks])).toEqual([
      ["t1", [1]],
      ["t2", [1]],
      ["t3", [1]],
    ]);
  });

  it("puts the clique, and not the boundary between the other two, on the card of the third", () => {
    expect(verdictsOn(folded, 1, "t3")).toEqual([CLIQUE_VERDICT]);
    expect(verdictsOn(folded, 1, "t1")).toEqual([BETWEEN, CLIQUE_VERDICT]);
  });
});

/** A boundary between `docs` (t5) and test code (t6) that took in the clique of both and `core/rest` (t4). */
const nested = territoryTreeReport({
  entryPoints: [
    entryPointOf(1, {
      kind: "boundary",
      territories: ["t5", "t6"],
      evidence: { sharedChanges: 12, partnerShare: 0.25 },
      verdict: BETWEEN,
      designMove: "Move a boundary: redraw the boundary between them.",
      findings: [
        finding(["t5", "t6"], BETWEEN, { sharedChanges: 12 }),
        finding(["t5"], "Docs leak.", {}),
        finding(["t6"], "Tests leak.", {}),
        {
          ...finding(["t4", "t5", "t6"], CLIQUE_VERDICT, {}),
          kind: "clique",
        },
      ],
    }),
  ],
});

describe("a clique that a pair took in, on the cards of a territory that holds only its third member", () => {
  it("gives the card of the third member the clique alone", () => {
    expect(verdictsOn(nested, 2, "t4")).toEqual([CLIQUE_VERDICT]);
  });

  it("gives the coarser card that holds the third member the clique alone, not the boundaries of the other two", () => {
    // at detail 1 `core` (t2) holds t4, and neither t5 nor t6
    expect(verdictsOn(nested, 1, "t2")).toEqual([CLIQUE_VERDICT]);
  });

  it("gives the card of a member of the pair its own boundary and the clique, not the other's", () => {
    expect(verdictsOn(nested, 2, "t5")).toEqual([
      BETWEEN,
      "Docs leak.",
      CLIQUE_VERDICT,
    ]);
  });
});
