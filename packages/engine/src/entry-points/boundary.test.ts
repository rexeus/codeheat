import { describe, expect, it } from "vitest";

import type { TerritoryFit } from "../report/territory-fit.js";
import { DEFAULT_THRESHOLDS } from "../testing/report-defaults.js";
import { fitRecord, territoryRecord } from "../testing/territory-record.js";
import { boundaryEntries as boundaryEntriesWith } from "./boundary.js";
import type { Judged } from "./judged-territories.js";

const judged = (
  id: string,
  heatShare: number,
  fit: Partial<TerritoryFit>,
): Judged => ({
  ...territoryRecord(id, "package", "r"),
  path: `packages/${id}`,
  heatShare,
  changes: 40,
  fit: fitRecord(fit),
});

const boundaryEntries = (
  judgedTerritories: ReadonlyArray<Judged>,
  paths: ReadonlyMap<string, string>,
  limits = DEFAULT_THRESHOLDS,
) => boundaryEntriesWith(judgedTerritories, paths, limits);

const PATHS = new Map([
  ["a", "packages/a"],
  ["b", "packages/b"],
]);

describe("boundaryEntries score", () => {
  it("is the heat that leaks", () => {
    const [entry] = boundaryEntries(
      [judged("a", 0.3, { containment: 0.4 })],
      PATHS,
    );

    expect(entry?.score).toBeCloseTo(0.18, 10);
    expect(entry?.kind).toBe("boundary");
    expect(entry?.territories).toStrictEqual(["a"]);
    expect(entry?.files).toStrictEqual([]);
  });

  it("is half as much again for a territory whose heat is mostly chronic", () => {
    const [entry] = boundaryEntries(
      [judged("a", 0.3, { containment: 0.4, chronicShare: 0.5 })],
      PATHS,
    );

    expect(entry?.score).toBeCloseTo(0.27, 10);
  });

  it("grows with the share of fixes among its changes", () => {
    const [entry] = boundaryEntries(
      [
        judged("a", 0.3, {
          containment: 0.4,
          fixDensity: { fixes: 8, share: 0.2, spanning: 3 },
        }),
      ],
      PATHS,
    );

    expect(entry?.score).toBeCloseTo(0.216, 10);
  });
});

describe("boundaryEntries gates", () => {
  it("leaves out a territory that keeps three quarters of its changes, or has none to judge", () => {
    expect(
      boundaryEntries(
        [
          judged("a", 0.3, { containment: 0.75 }),
          judged("b", 0.3, { containment: 0.76 }),
          judged("c", 0.3, { containment: null }),
        ],
        PATHS,
      ).map(({ territories }) => territories),
    ).toStrictEqual([["a"]]);
  });

  it("leaves out a territory with less than two percent of the heat", () => {
    expect(
      boundaryEntries(
        [
          judged("a", 0.0199, { containment: 0 }),
          judged("b", 0.02, { containment: 0 }),
        ],
        PATHS,
      ).map(({ territories }) => territories),
    ).toStrictEqual([["b"]]);
  });
});

describe("boundaryEntries limits", () => {
  it("reads the gates from the limits", () => {
    const territories = [
      judged("a", 0.03, { containment: 0.8, chronicShare: 0.4 }),
    ];

    expect(boundaryEntries(territories, PATHS)).toStrictEqual([]);
    const [entry] = boundaryEntries(territories, PATHS, {
      ...DEFAULT_THRESHOLDS,
      maxEntryContainment: 0.9,
      minEntryChronicShare: 0.4,
    });
    // heat 0.03 × leak 0.2 × chronic 1.5
    expect(entry?.score).toBeCloseTo(0.009, 10);
  });
});

describe("boundaryEntries words and evidence", () => {
  it("names the partner in the move and gives the numbers by name, leaving out those that do not exist", () => {
    const [entry] = boundaryEntries(
      [
        judged("a", 0.3, {
          containment: 0.4,
          distantPairs: 6,
          hiddenPairs: 2,
          cliques: 1,
          partner: { territory: "b", sharedChanges: 9, share: 0.225 },
        }),
      ],
      PATHS,
    );

    expect(entry?.evidence).toStrictEqual({
      heatShare: 0.3,
      containment: 0.4,
      changes: 40,
      chronicShare: 0,
      distantPairs: 6,
      hiddenPairs: 2,
      cliques: 1,
      partnerShare: 0.225,
    });
    expect(entry?.verdict).toBe(
      "The boundary does not hold: changes here keep reaching into other territories.",
    );
    expect(entry?.designMove).toBe(
      "Move a boundary: bring what changes together with packages/a into one territory, or give the part they share a home of its own; start with packages/b.",
    );
  });

  it("says so when the territory has no partner, and when it also erodes", () => {
    const [entry] = boundaryEntries(
      [
        judged("a", 0.3, {
          containment: 0.4,
          erosion: {
            from: 0.7,
            to: 0.4,
            slope: -0.05,
            verdict: "eroding",
            windows: 6,
            cohesion: [],
            recent: true,
          },
        }),
      ],
      PATHS,
    );

    expect(entry?.designMove).toBe(
      "Move a boundary: bring what changes together with packages/a into one territory, or give the part they share a home of its own.",
    );
    expect(entry?.verdict).toBe(
      "The boundary does not hold, and it holds less than it used to: changes here keep reaching into other territories.",
    );
  });
});
