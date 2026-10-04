import { describe, expect, it } from "vitest";

import type { TerritoryFit } from "../report/territory-fit.js";
import { NO_CROSSINGS } from "../territory-fit/crossing-pairs.js";
import { DEFAULT_THRESHOLDS } from "../testing/report-defaults.js";
import { fitRecord, territoryRecord } from "../testing/territory-record.js";
import { boundaryEntries as boundaryEntriesWith } from "./boundary.js";
import type { BoundaryContext } from "./boundary.js";
import type { Judged } from "./judged-territories.js";

const judged = (
  id: string,
  shares: { readonly code: number; readonly all: number },
  changes: number,
  fit: Partial<TerritoryFit>,
): Judged => ({
  ...territoryRecord(id, "package", "r"),
  path: `packages/${id}`,
  heatShare: shares.all,
  codeHeatShare: shares.code,
  changes,
  fit: fitRecord(fit),
});

const PATHS = new Map(
  ["a", "b", "c"].map((id) => [id, `packages/${id}`] as const),
);

const boundaryEntries = (
  territories: ReadonlyArray<Judged>,
  context: Partial<BoundaryContext> = {},
) =>
  boundaryEntriesWith(territories, {
    pathOf: PATHS,
    limits: DEFAULT_THRESHOLDS,
    crossings: NO_CROSSINGS,
    cliques: [],
    ...context,
  });

/** Replaces some of what the fit of `territory` says. */
const refit = (territory: Judged, fit: Partial<TerritoryFit>): Judged => ({
  ...territory,
  fit: fitRecord({ ...territory.fit, ...fit }),
});

/** `a` leaks into `b` and `b` into `a`, 12 changes touching both. */
const A = judged("a", { code: 0.3, all: 0.35 }, 40, {
  containment: 0.4,
  partner: { territory: "b", sharedChanges: 12, share: 0.3 },
  distantPairs: 6,
  hiddenPairs: 2,
  cliques: 1,
});
const B = judged("b", { code: 0.1, all: 0.12 }, 20, {
  containment: 0.5,
  chronicShare: 0.6,
  partner: { territory: "a", sharedChanges: 12, share: 0.6 },
  distantPairs: 4,
  hiddenPairs: 1,
  cliques: 2,
});

const ERODING = {
  from: 0.7,
  to: 0.4,
  slope: -0.05,
  verdict: "eroding" as const,
  windows: 6,
  cohesion: [],
  recent: true,
};

const withFixes = (share: number | null) => ({
  fixDensity: share === null ? null : { fixes: 4, share, spanning: 1 },
});

/** The share of fixes of the entry about `a` and `b` when each has the given share (null: unknown). */
const fixShareOf = (a: number | null, b: number | null) =>
  boundaryEntries([refit(A, withFixes(a)), refit(B, withFixes(b))])[0]
    ?.evidence["fixShare"];

describe("boundaryEntries of two territories that leak into each other", () => {
  it("is one entry about both, the stronger first, scored as the sum of the two", () => {
    const entries = boundaryEntries([A, B]);

    // a: 0.3 × 0.6 = 0.18; b: 0.1 × 0.5 × 1.5 (chronic) = 0.075
    expect(entries).toHaveLength(1);
    expect(entries[0]?.kind).toBe("boundary");
    expect(entries[0]?.territories).toStrictEqual(["a", "b"]);
    expect(entries[0]?.files).toStrictEqual([]);
    expect(entries[0]?.score).toBeCloseTo(0.255, 10);
  });

  it("leads with the stronger territory whichever comes first", () => {
    const [entry] = boundaryEntries([B, A]);

    expect(entry?.territories).toStrictEqual(["a", "b"]);
  });

  it("says the boundary between both does not hold, and what to do about it", () => {
    const [entry] = boundaryEntries([A, B]);

    expect(entry?.verdict).toBe(
      "The boundary between packages/a and packages/b does not hold: changes in one keep reaching into the other.",
    );
    expect(entry?.designMove).toBe(
      "Move a boundary: redraw the boundary between packages/a and packages/b, or give what they share a home of its own.",
    );
  });

  it("says so when either territory also erodes", () => {
    const [entry] = boundaryEntries([A, refit(B, { erosion: ERODING })]);

    expect(entry?.verdict).toBe(
      "The boundary between packages/a and packages/b does not hold, and it holds less than it used to: changes in one keep reaching into the other.",
    );
  });
});

const unit = (modules: ReadonlyArray<string>) => ({
  modules,
  sharedCommits: 5,
  weakestShare: 0.5,
  reason: "",
});

/** Three file pairs between a and b, one of them without an import. */
const BETWEEN_A_AND_B = {
  ofArea: new Map(),
  ofPair: new Map([["a", new Map([["b", { pairs: 3, hidden: 1 }]])]]),
};

/** Three of the four have a or b as a member. */
const CLIQUES = [
  unit(["a", "c", "x"]),
  unit(["b", "y", "z"]),
  unit(["a", "b", "w"]),
  unit(["x", "y", "z"]),
];

describe("boundaryEntries of two territories, evidence", () => {
  it("gives the numbers of both together under the names of one boundary, each change and file pair counted once", () => {
    const [entry] = boundaryEntries([A, B], {
      crossings: BETWEEN_A_AND_B,
      cliques: CLIQUES,
    });

    // changes: 40 + 20 − 12 shared; containment: the 16 changes that stayed inside a and
    // the 10 inside b (0.4 × 40, 0.5 × 20) over those 48; partner: 12 of the 48;
    // chronic: (0 × 0.3 + 0.6 × 0.1) / 0.4; file pairs: 6 + 4 − 3 between the two once,
    // 2 + 1 − 1 without an import; cliques: three have a or b as a member
    expect(entry?.evidence).toStrictEqual({
      codeHeatShare: 0.4,
      heatShare: 0.47,
      containment: 0.5417,
      changes: 48,
      sharedChanges: 12,
      chronicShare: 0.15,
      distantPairs: 7,
      hiddenPairs: 2,
      cliques: 3,
      partnerShare: 0.25,
    });
  });
});

describe("boundaryEntries of two territories, findings", () => {
  it("weights the share of fixes by changes, and takes the one that is known", () => {
    expect(fixShareOf(0.2, 0.5)).toBeCloseTo(0.3, 4);
    expect(fixShareOf(0.2, null)).toBe(0.2);
    expect(fixShareOf(null, null)).toBe(undefined);
  });

  it("keeps the boundary of each territory as a finding of its own, the stronger first", () => {
    const [entry] = boundaryEntries([A, B]);

    expect(
      entry?.parts?.map(({ kind, territories, evidence, designMove }) => [
        kind,
        territories,
        evidence["containment"],
        designMove,
      ]),
    ).toStrictEqual([
      [
        "boundary",
        ["a"],
        0.4,
        "Move a boundary: bring what changes together with packages/a into one territory, or give the part they share a home of its own; start with packages/b.",
      ],
      [
        "boundary",
        ["b"],
        0.5,
        "Move a boundary: bring what changes together with packages/b into one territory, or give the part they share a home of its own; start with packages/a.",
      ],
    ]);
  });
});

describe("boundaryEntries of territories that are not each other's partner", () => {
  it("keeps one entry each when the one reached is reached from somewhere else", () => {
    const entries = boundaryEntries([
      A,
      refit(B, { partner: { territory: "c", sharedChanges: 12, share: 0.6 } }),
    ]);

    expect(entries.map(({ territories }) => territories)).toStrictEqual([
      ["a"],
      ["b"],
    ]);
  });

  it("keeps the territory that leaks alone when the one it leaks into holds its boundary", () => {
    const entries = boundaryEntries([A, refit(B, { containment: 0.9 })]);

    expect(entries.map(({ territories }) => territories)).toStrictEqual([
      ["a"],
    ]);
    expect(entries[0]?.parts).toBe(undefined);
  });
});
