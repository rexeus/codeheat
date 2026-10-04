import type { Report } from "@codeheat/engine";
import { describe, expect, it } from "vitest";

import { indexTerritories } from "../territories/territory-index.js";
import { boundaryOn, reportWithParts } from "../testing/design-fit.js";
import type { PartSpec } from "../testing/design-fit.js";
import { reportOf } from "../testing/reports.js";
import { deriveVerdict } from "./derive-verdict.js";

const verdictOf = (report: Report) =>
  deriveVerdict(report, indexTerritories(report.territories));

const parts = (leaking: number, holding: number): PartSpec[] => [
  { id: "t1", path: "packages/a", heat: leaking, containment: 0.3 },
  { id: "t2", path: "packages/b", heat: holding, containment: 0.9 },
];

const erosion = (verdict: "eroding" | "improving" | "holding" | "unknown") =>
  ({
    verdict,
    inactiveSince: null,
    windows: 8,
    locality: { from: 0.8, to: 0.6, slope: -0.02 },
    propagationCost: null,
  }) satisfies NonNullable<Report["erosion"]>;

describe("deriveVerdict level", () => {
  it.each([
    [0.1, 0.9, "holds", "Holds up"],
    [0.3, 0.7, "mixed", "Holds in parts"],
    [0.6, 0.4, "strained", "Under strain"],
  ] as const)(
    "reads %s of the heat in leaking territories as %s",
    (leaking, holding, level, label) => {
      const verdict = verdictOf(reportWithParts(parts(leaking, holding)));

      expect(verdict.level).toBe(level);
      expect(verdict.label).toBe(label);
    },
  );

  it("calls a design strained from half of the effort in leaking territories", () => {
    expect(verdictOf(reportWithParts(parts(0.5, 0.5))).level).toBe("strained");
  });
});

describe("deriveVerdict what counts", () => {
  it("weights territories by their heat, not by their number", () => {
    const report = reportWithParts([
      { id: "t1", path: "a", heat: 0.05, containment: 0.1 },
      { id: "t2", path: "b", heat: 0.05, containment: 0.1 },
      { id: "t3", path: "c", heat: 0.05, containment: 0.1 },
      { id: "t4", path: "d", heat: 0.85, containment: 0.95 },
    ]);

    expect(verdictOf(report).level).toBe("holds");
  });

  it("judges only real territories: buckets and test code leave it out", () => {
    const report = reportWithParts([
      { id: "t1", path: "a", heat: 0.2, containment: 0.9 },
      { id: "t2", path: "b", heat: 0.5, containment: 0.1, kind: "other" },
      { id: "t3", path: "c", heat: 0.3, containment: null, kind: "tests" },
    ]);

    expect(verdictOf(report).level).toBe("holds");
  });

  it("uses the containment the report names as the limit", () => {
    const report = reportWithParts(parts(0.5, 0.5));
    const strict = {
      ...report,
      thresholds: { ...report.thresholds, maxEntryContainment: 0.95 },
    };

    expect(verdictOf(strict).level).toBe("strained");
    expect(verdictOf(strict).sentence).toContain(
      "holding all of the change effort",
    );
  });

  it("is unknown when no real territory has changes to measure", () => {
    const verdict = verdictOf(
      reportWithParts([{ id: "t1", path: "a", heat: 0.5, containment: null }]),
    );

    expect(verdict).toMatchObject({
      level: "unknown",
      label: "Not enough data",
      sentence: "There is not enough history to judge the design yet.",
    });
  });

  it("says plainly that a report without territories cannot be judged", () => {
    const verdict = verdictOf(reportOf([]));

    expect(verdict.level).toBe("unknown");
    expect(verdict.sentence).toBe(
      "This report has no territories, so it cannot say whether the design holds; analyze again with a current codeheat.",
    );
    expect(verdict.facts.map(({ value }) => value)).toEqual(["No trend yet"]);
  });
});

describe("deriveVerdict trend", () => {
  it("judges an eroding design one level worse and says so", () => {
    const report = reportWithParts(parts(0.1, 0.9), {
      erosion: erosion("eroding"),
    });

    const verdict = verdictOf(report);

    expect(verdict.level).toBe("mixed");
    expect(verdict.sentence).toBe(
      "In some places it does not: territories holding 10% of the change effort keep reaching into their neighbors, and it is getting worse.",
    );
  });

  it("does not go below strained for an eroding design", () => {
    const report = reportWithParts(parts(0.6, 0.4), {
      erosion: erosion("eroding"),
    });

    expect(verdictOf(report).level).toBe("strained");
  });

  it("mentions an improving design without judging it better", () => {
    const report = reportWithParts(parts(0.3, 0.7), {
      erosion: erosion("improving"),
    });

    const verdict = verdictOf(report);

    expect(verdict.level).toBe("mixed");
    expect(verdict.sentence).toMatch(/, and it is getting better\.$/u);
  });
});

describe("deriveVerdict sentence", () => {
  it("names the share that holds when the design holds", () => {
    expect(verdictOf(reportWithParts(parts(0.1, 0.9))).sentence).toBe(
      "Changes stay where they start: territories holding 90% of the change effort contain them.",
    );
  });

  it("names the share that leaks when it is under strain", () => {
    expect(verdictOf(reportWithParts(parts(0.6, 0.4))).sentence).toBe(
      "Not where it matters: territories holding 60% of the change effort keep reaching into their neighbors.",
    );
  });

  it("says all when every real territory leaks", () => {
    const report = reportWithParts([
      { id: "t1", path: "a", heat: 0.7, containment: 0.1 },
      { id: "t2", path: "b", heat: 0.3, containment: 0.2 },
    ]);

    expect(verdictOf(report).sentence).toBe(
      "Not where it matters: territories holding all of the change effort keep reaching into their neighbors.",
    );
  });
});

describe("deriveVerdict facts", () => {
  const report = reportWithParts(parts(0.6, 0.4), {
    changeRadius: { changes: 40, median: 2, p90: 3, local: 0.6 },
    propagationCost: { cost: 0.25, files: 40 },
    erosion: erosion("holding"),
    entryPoints: [
      boundaryOn(1, ["t1"]),
      boundaryOn(2, ["t2"]),
      boundaryOn(3, ["t1"]),
      boundaryOn(4, ["t2"]),
    ],
  });

  it("lists the leaking territories, the weight of the top places, the trend, and the propagation cost", () => {
    expect(verdictOf(report).facts).toEqual([
      {
        value: "1 of 2",
        label: "territories keep less than 75% of their changes inside",
        note: "",
      },
      {
        value: "100%",
        label: "of the change effort sits in the top 3 places to start",
        note: "",
      },
      {
        value: "Holding steady",
        label: "over the last quarters",
        note: "80% → 60% of changes stay in one module (higher is better; the shift is not significant)",
      },
      {
        value: "25%",
        label: "of the code a change drags along (propagation cost)",
        note: "through chains of couplings, over 40 files",
      },
    ]);
  });

  it("does not put the module-based change radius beside a territory-based verdict", () => {
    const labels = verdictOf(report).facts.map(({ label }) => label);

    expect(labels.join(" ")).not.toContain("modules a typical change touches");
  });
});

describe("deriveVerdict facts about the trend and the count", () => {
  const report = reportWithParts(parts(0.6, 0.4), {
    erosion: erosion("holding"),
    entryPoints: [boundaryOn(1, ["t1"]), boundaryOn(2, ["t1"])],
  });

  it("says in the engine's terms whether a falling trend is significant", () => {
    const falling = { ...report, erosion: erosion("eroding") };

    expect(verdictOf(falling).facts[2]).toEqual({
      value: "Getting worse",
      label: "over the last quarters",
      note: "80% → 60% of changes stay in one module (higher is better; this fall is significant)",
    });
  });

  it("counts a territory once however many top places concern it", () => {
    const single = {
      ...report,
      entryPoints: [boundaryOn(1, ["t1"]), boundaryOn(2, ["t1"])],
    };

    expect(verdictOf(single).facts[1]).toEqual({
      value: "60%",
      label: "of the change effort sits in the top 2 places to start",
      note: "",
    });
  });

  it("leaves out what the report does not measure", () => {
    const bare = reportWithParts(parts(0.6, 0.4));

    expect(verdictOf(bare).facts).toEqual([
      {
        value: "1 of 2",
        label: "territories keep less than 75% of their changes inside",
        note: "",
      },
      { value: "No trend yet", label: "over the last quarters", note: "" },
    ]);
  });

  it("names a single territory in the singular", () => {
    const one = reportWithParts([
      { id: "t1", path: "a", heat: 0.5, containment: 0.1 },
    ]);

    expect(verdictOf(one).facts[0]?.label).toBe(
      "territory keeps less than 75% of its changes inside",
    );
  });
});
