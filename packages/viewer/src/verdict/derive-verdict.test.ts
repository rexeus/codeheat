import type { Report } from "@codeheat/engine";
import { describe, expect, it } from "vitest";

import { indexTerritories } from "../territories/territory-index.js";
import { erosionOf, reportWithParts } from "../testing/design-fit.js";
import type { PartSpec } from "../testing/design-fit.js";
import { reportOf } from "../testing/reports.js";
import { deriveVerdict } from "./derive-verdict.js";

const verdictOf = (report: Report) =>
  deriveVerdict(report, indexTerritories(report.territories));

const parts = (leaking: number, holding: number): PartSpec[] => [
  { id: "t1", path: "packages/a", heat: leaking, containment: 0.3 },
  { id: "t2", path: "packages/b", heat: holding, containment: 0.9 },
];

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
      { id: "t1", path: "a", heat: 0.6, containment: 0.9 },
      { id: "t2", path: "b", heat: 0.3, containment: 0.1, kind: "other" },
      { id: "t3", path: "c", heat: 0.1, containment: null, kind: "tests" },
    ]);

    expect(verdictOf(report).level).toBe("holds");
  });
});

describe("deriveVerdict leak target", () => {
  it("does not call a territory leaking that no other territory shares changes with", () => {
    const report = reportWithParts([
      { id: "t1", path: "a", heat: 0.7, containment: 0.6, partner: null },
    ]);

    const verdict = verdictOf(report);

    expect(verdict.level).toBe("unknown");
    expect(verdict.label).toBe("Not enough evidence");
  });

  it("leaves such a territory out of the judged ones, and counts the rest", () => {
    const report = reportWithParts([
      { id: "t1", path: "a", heat: 0.4, containment: 0.3, partner: null },
      { id: "t2", path: "b", heat: 0.3, containment: 0.3 },
      { id: "t3", path: "c", heat: 0.3, containment: 0.9, partner: null },
    ]);

    const [leakFact] = verdictOf(report).facts;

    // a is not judged (no leak target), b leaks, c holds: 1 of 2
    expect(leakFact?.value).toBe("1 of 2");
    expect(verdictOf(report).level).toBe("mixed");
  });
});

describe("deriveVerdict leak line", () => {
  it("counts a territory that keeps exactly the limit as leaking, and one above it as holding", () => {
    const report = reportWithParts([
      { id: "t1", path: "a", heat: 0.6, containment: 0.75 },
      { id: "t2", path: "b", heat: 0.4, containment: 0.76 },
    ]);

    const verdict = verdictOf(report);

    expect(verdict.level).toBe("strained");
    expect(verdict.sentence).toBe(
      "Not where it matters: territories holding 60% of the change effort keep reaching into their neighbors.",
    );
  });

  it("uses the containment the report names as the limit", () => {
    const report = reportWithParts(parts(0.5, 0.5));
    const strict = {
      ...report,
      thresholds: { ...report.thresholds, maxEntryContainment: 0.95 },
    };

    expect(verdictOf(strict).sentence).toContain(
      "holding all of the change effort",
    );
  });
});

const unjudged = (judged: number, heat: number): Report =>
  reportWithParts([
    { id: "t1", path: "a", heat: judged, containment: 0.1, changes: 12 },
    { id: "t2", path: "b", heat, containment: 0.1, changes: 2 },
  ]);

describe("deriveVerdict coverage", () => {
  it("divides by all of the repository's heat, so unjudged territories dilute the share", () => {
    const report = reportWithParts([
      { id: "t1", path: "a", heat: 0.3, containment: 0.1, changes: 12 },
      { id: "t2", path: "b", heat: 0.3, containment: 0.9, changes: 30 },
      { id: "t3", path: "c", heat: 0.4, containment: 0, changes: 2 },
    ]);

    const verdict = verdictOf(report);

    expect(verdict.level).toBe("mixed");
    expect(verdict.sentence).toBe(
      "In some places it does not: territories holding 30% of the change effort keep reaching into their neighbors.",
    );
  });

  it("gives no verdict when the judged territories hold less than half of all the heat", () => {
    expect(verdictOf(unjudged(0.49, 0.51))).toMatchObject({
      level: "unknown",
      label: "Not enough evidence",
      sentence:
        "Too little of the change effort sits in territories with enough changes to judge the design.",
    });
  });

  it("gives a verdict from exactly half of all the heat", () => {
    expect(verdictOf(unjudged(0.5, 0.5)).level).toBe("strained");
  });

  it("gives no verdict when no real territory has changes to measure", () => {
    const verdict = verdictOf(
      reportWithParts([{ id: "t1", path: "a", heat: 0.5, containment: null }]),
    );

    expect(verdict).toMatchObject({
      level: "unknown",
      label: "Not enough evidence",
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
      erosion: erosionOf("eroding"),
    });

    const verdict = verdictOf(report);

    expect(verdict.level).toBe("mixed");
    expect(verdict.sentence).toBe(
      "In some places it does not: territories holding 10% of the change effort keep reaching into their neighbors, and it is getting worse.",
    );
  });

  it("does not go below strained for an eroding design", () => {
    const report = reportWithParts(parts(0.6, 0.4), {
      erosion: erosionOf("eroding"),
    });

    expect(verdictOf(report).level).toBe("strained");
  });

  it("mentions an improving design without judging it better", () => {
    const report = reportWithParts(parts(0.3, 0.7), {
      erosion: erosionOf("improving"),
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
