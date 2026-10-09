import { describe, expect, it } from "vitest";

import type { Territories, Territory } from "../model/territory.js";
import { windowsStaying } from "../testing/area-windows.js";
import { DEFAULT_THRESHOLDS } from "../testing/report-defaults.js";
import { fitRecord, territoryRecord } from "../testing/territory-record.js";
import { judgeVerdict } from "./judge-verdict.js";

/** A territory at the recommended detail: `{ id, heat, containment }`, a folder with 20 changes that leaks to a territory elsewhere unless overridden. */
type PartSpec = {
  readonly id: string;
  readonly heat: number;
  readonly containment: number | null;
  readonly kind?: Territory["kind"];
  readonly changes?: number;
  readonly partner?: NonNullable<Territory["fit"]>["partner"];
};

const ELSEWHERE = { territory: "elsewhere", sharedChanges: 5, share: 0.25 };

/** A root with `parts` as its children, all visible at the one detail, which is the recommended one. */
const territoriesOf = (parts: ReadonlyArray<PartSpec>): Territories => ({
  recommended: 1,
  details: [{ level: 1, ids: parts.map(({ id }) => id) }],
  nodes: [
    territoryRecord(
      "root",
      "folder",
      null,
      parts.map(({ id }) => id),
    ),
    ...parts.map((part): Territory => ({
      ...territoryRecord(part.id, part.kind ?? "folder", "root"),
      changes: part.changes ?? 20,
      heatShare: part.heat,
      fit: fitRecord({
        containment: part.containment,
        partner: part.partner === undefined ? ELSEWHERE : part.partner,
      }),
    })),
  ],
});

/** Six windows in which `t1` keeps ever less of its changes inside, and six in which it keeps ever more. */
const FALLING = windowsStaying([0.9, 0.8, 0.7, 0.6, 0.5, 0.4]);
const RISING = windowsStaying([0.4, 0.5, 0.6, 0.7, 0.8, 0.9]);

const judge = (
  parts: ReadonlyArray<PartSpec>,
  options: {
    readonly windows?: ReadonlyArray<ReadonlyArray<ReadonlySet<string>>>;
    readonly realCommits?: number;
    readonly maxEntryContainment?: number;
  } = {},
) =>
  judgeVerdict({
    territories: territoriesOf(parts),
    windows: options.windows ?? [],
    realCommits: options.realCommits ?? 40,
    limits: {
      ...DEFAULT_THRESHOLDS,
      maxEntryContainment:
        options.maxEntryContainment ?? DEFAULT_THRESHOLDS.maxEntryContainment,
    },
  });

/** One leaking and one holding territory with the given heat. */
const twoParts = (
  leaking: number,
  holding: number,
): ReadonlyArray<PartSpec> => [
  { id: "t1", heat: leaking, containment: 0.3 },
  { id: "t2", heat: holding, containment: 0.9 },
];

describe("judgeVerdict level", () => {
  it.each([
    [0.1, 0.9, "holds"],
    [0.3, 0.7, "mixed"],
    [0.6, 0.4, "strained"],
  ] as const)(
    "reads %s of the heat in leaking territories as %s",
    (leaking, holding, level) => {
      expect(judge(twoParts(leaking, holding)).level).toBe(level);
    },
  );

  it("calls a design strained from half of the effort in leaking territories", () => {
    expect(judge(twoParts(0.5, 0.5)).level).toBe("strained");
  });

  it("weights territories by their heat, not by their number", () => {
    const verdict = judge([
      { id: "t1", heat: 0.05, containment: 0.1 },
      { id: "t2", heat: 0.05, containment: 0.1 },
      { id: "t3", heat: 0.05, containment: 0.1 },
      { id: "t4", heat: 0.85, containment: 0.95 },
    ]);

    expect(verdict.level).toBe("holds");
  });

  it("judges only real territories: buckets leave it out", () => {
    const verdict = judge([
      { id: "t1", heat: 0.7, containment: 0.9 },
      { id: "t2", heat: 0.3, containment: 0.1, kind: "other" },
    ]);

    expect(verdict).toMatchObject({ level: "holds", judged: ["t1"] });
  });
});

describe("judgeVerdict leak target", () => {
  it("does not call a territory leaking that no other territory shares changes with", () => {
    const verdict = judge([
      { id: "t1", heat: 0.7, containment: 0.6, partner: null },
    ]);

    expect(verdict).toMatchObject({
      level: "unknown",
      reason: "too-little-evidence",
      judged: [],
    });
  });

  it("leaves such a territory out of the judged ones, and judges the rest", () => {
    // a is not judged (no leak target), b leaks, c holds: 30 % leaks
    const verdict = judge([
      { id: "a", heat: 0.4, containment: 0.3, partner: null },
      { id: "b", heat: 0.3, containment: 0.3 },
      { id: "c", heat: 0.3, containment: 0.9, partner: null },
    ]);

    expect(verdict.level).toBe("mixed");
  });
});

describe("judgeVerdict leak line", () => {
  it("counts a territory that keeps exactly the limit as leaking, and one above it as holding", () => {
    const verdict = judge([
      { id: "t1", heat: 0.6, containment: 0.75 },
      { id: "t2", heat: 0.4, containment: 0.76 },
    ]);

    expect(verdict).toMatchObject({ level: "strained", leaking: ["t1"] });
  });

  it("uses the containment the thresholds name as the limit", () => {
    expect(judge(twoParts(0.1, 0.9)).level).toBe("holds");
    expect(judge(twoParts(0.1, 0.9), { maxEntryContainment: 0.95 }).level).toBe(
      "strained",
    );
  });
});

describe("judgeVerdict coverage", () => {
  it("divides by all of the repository's heat, so unjudged territories dilute the share", () => {
    const verdict = judge([
      { id: "t1", heat: 0.3, containment: 0.1, changes: 12 },
      { id: "t2", heat: 0.3, containment: 0.9, changes: 30 },
      { id: "t3", heat: 0.4, containment: 0, changes: 2 },
    ]);

    expect(verdict).toStrictEqual({
      level: "mixed",
      reason: null,
      leakShare: 0.3,
      coverage: 0.6,
      judged: ["t1", "t2"],
      leaking: ["t1"],
      eroding: false,
      trend: "unknown",
    });
  });

  it("gives no verdict when the judged territories hold less than half of all the heat, and says why", () => {
    const verdict = judge([
      { id: "t1", heat: 0.49, containment: 0.1, changes: 12 },
      { id: "t2", heat: 0.51, containment: 0.1, changes: 2 },
    ]);

    expect(verdict).toMatchObject({
      level: "unknown",
      reason: "too-little-evidence",
      coverage: 0.49,
    });
  });

  it("gives a verdict from exactly half of all the heat", () => {
    const verdict = judge([
      { id: "t1", heat: 0.5, containment: 0.1, changes: 12 },
      { id: "t2", heat: 0.5, containment: 0.1, changes: 2 },
    ]);

    expect(verdict.level).toBe("strained");
  });

  it("gives no verdict when no real territory has changes to measure", () => {
    const verdict = judge([{ id: "t1", heat: 0.5, containment: null }]);

    expect(verdict).toMatchObject({
      level: "unknown",
      reason: "too-little-evidence",
      leakShare: 0,
      coverage: 0,
    });
  });
});

describe("judgeVerdict reason", () => {
  it("says plainly that a report without territories cannot be judged", () => {
    const verdict = judgeVerdict({
      territories: { recommended: 0, details: [], nodes: [] },
      windows: [],
      realCommits: 0,
      limits: DEFAULT_THRESHOLDS,
    });

    expect(verdict).toStrictEqual({
      level: "unknown",
      reason: "no-territories",
      leakShare: 0,
      coverage: 0,
      judged: [],
      leaking: [],
      eroding: false,
      trend: "unknown",
    });
  });

  it("names a window without real commits as the reason", () => {
    const verdict = judge([{ id: "t1", heat: 0, containment: null }], {
      realCommits: 0,
    });

    expect(verdict).toMatchObject({ level: "unknown", reason: "quiet-window" });
  });
});

describe("judgeVerdict trend", () => {
  it("judges a design whose judged territories keep ever less inside one level worse", () => {
    const verdict = judge(twoParts(0.1, 0.9), { windows: FALLING });

    expect(verdict).toMatchObject({
      level: "mixed",
      eroding: true,
      trend: "eroding",
    });
  });

  it("does not go below strained for an eroding design", () => {
    const verdict = judge(twoParts(0.6, 0.4), { windows: FALLING });

    expect(verdict.level).toBe("strained");
  });

  it("does not judge an improving design better", () => {
    const verdict = judge(twoParts(0.3, 0.7), { windows: RISING });

    expect(verdict).toMatchObject({
      level: "mixed",
      eroding: false,
      trend: "improving",
    });
  });

  it("reads the trend of the judged territories only", () => {
    const verdict = judge(twoParts(0.1, 0.9), {
      windows: windowsStaying([0.9, 0.8, 0.7, 0.6, 0.5, 0.4], { area: "t9" }),
    });

    expect(verdict).toMatchObject({
      level: "holds",
      eroding: false,
      trend: "unknown",
    });
  });
});

describe("judgeVerdict order", () => {
  it("lists the judged and the leaking territories with the most heat first", () => {
    const verdict = judge([
      { id: "t1", heat: 0.2, containment: 0.3 },
      { id: "t2", heat: 0.5, containment: 0.9 },
      { id: "t3", heat: 0.3, containment: 0.1 },
    ]);

    expect(verdict).toMatchObject({
      judged: ["t2", "t3", "t1"],
      leaking: ["t3", "t1"],
      leakShare: 0.5,
      coverage: 1,
    });
  });
});

describe("judgeVerdict on the shares it reports", () => {
  it("decides the level on the rounded leak share, so a reported 0.2 is never holds", () => {
    // 0.1994 + 0.0006 sums to just below 0.2 in floating point
    const verdict = judge([
      { id: "t1", heat: 0.8, containment: 0.9 },
      { id: "t2", heat: 0.1994, containment: 0.3 },
      { id: "t3", heat: 0.0006, containment: 0.3 },
    ]);

    expect(verdict).toMatchObject({ level: "mixed", leakShare: 0.2 });
  });

  it("decides on the rounded coverage, so a reported half of the heat has a level", () => {
    // 0.25 + 0.1284 + 0.1216 sums to just below 0.5 in floating point
    const verdict = judge([
      { id: "t1", heat: 0.25, containment: 0.9 },
      { id: "t2", heat: 0.1284, containment: 0.9 },
      { id: "t3", heat: 0.1216, containment: 0.9 },
      { id: "t4", heat: 0.5, containment: 0.1, changes: 2 },
    ]);

    expect(verdict).toMatchObject({ level: "holds", coverage: 0.5 });
  });
});
