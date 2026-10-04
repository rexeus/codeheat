import type { Report } from "@codeheat/engine";
import { describe, expect, it } from "vitest";

import { indexTerritories } from "../territories/territory-index.js";
import { reportWithParts } from "../testing/design-fit.js";
import { deriveVerdict } from "./derive-verdict.js";
import { quietWindowOf } from "./quiet-window.js";

type Window = Report["series"][number];

const quarter = (since: string, until: string, changes: number): Window => ({
  since,
  until,
  changes,
  active: false,
  changeRadius: null,
  propagationCost: null,
});

const quietReport = (series: readonly Window[], seriesSince: string | null) => {
  const base = reportWithParts([
    { id: "t1", path: "src/a", heat: 0, containment: null },
  ]);
  return {
    ...base,
    window: { ...base.window, commits: 0, realCommits: 0, couplingCommits: 0 },
    series,
    seriesSince,
  };
};

describe("quietWindowOf", () => {
  it("says when the history last changed and suggests a longer window", () => {
    const report = quietReport(
      [
        quarter("2025-04-04T17:20:00.000Z", "2025-07-04T23:20:00.000Z", 4),
        quarter("2025-07-04T23:20:00.000Z", "2025-10-04T05:20:00.000Z", 1),
        quarter("2025-10-04T05:20:00.000Z", "2026-01-03T11:20:00.000Z", 0),
      ],
      "2025-04-04T17:20:00.000Z",
    );

    expect(quietWindowOf(report)).toEqual({
      sentence:
        "No counted changes in this window, so there is nothing to judge.",
      note: "The last counted changes fall between 2025-07-04 and 2025-10-04. A longer window, set with --since, would include them.",
    });
  });

  it("says the series has no counted change either when no quarter has one", () => {
    const report = quietReport(
      [quarter("2024-10-04T05:20:00.000Z", "2025-01-03T11:20:00.000Z", 0)],
      "2024-10-04T05:20:00.000Z",
    );

    expect(quietWindowOf(report)?.note).toBe(
      "The history from 2024-10-04 on has no counted changes either; try a longer window with --since.",
    );
  });

  it("still suggests --since for a report without a series", () => {
    expect(quietWindowOf(quietReport([], null))?.note).toBe(
      "Try a longer window with --since.",
    );
  });

  it("says nothing for a window with a real change", () => {
    const busy = reportWithParts([
      { id: "t1", path: "src/a", heat: 0.5, containment: 0.5 },
    ]);

    expect(quietWindowOf(busy)).toBeNull();
  });
});

/** A quiet report whose window holds `commits` commits and whose newest commit was made at `lastCommitAt`. */
const known = (lastCommitAt: string, commits: number) => {
  const report = quietReport(
    [quarter("2025-04-04T17:20:00.000Z", "2025-07-04T23:20:00.000Z", 4)],
    "2025-04-04T17:20:00.000Z",
  );
  return {
    ...report,
    window: { ...report.window, commits, lastCommitAt },
  };
};

describe("quietWindowOf with the day of the newest commit", () => {
  it("says on which day the last commit was made, in place of the span of the series", () => {
    expect(quietWindowOf(known("2025-03-14T09:15:30.000Z", 0))?.note).toBe(
      "The last commit was on 2025-03-14. A longer window, set with --since, would include it.",
    );
  });

  it("says the commits of the window do not count when the last one lies inside it", () => {
    const report = known("2026-09-01T08:00:00.000Z", 3);

    expect(quietWindowOf(report)?.note).toBe(
      "The last commit was on 2026-09-01, but the commits of this window are mechanical and do not count.",
    );
  });
});

describe("the verdict of a window without counted changes", () => {
  it("replaces the evidence sentence and carries the note", () => {
    const report = quietReport([], null);

    const verdict = deriveVerdict(report, indexTerritories(report.territories));

    expect(verdict).toMatchObject({
      level: "unknown",
      sentence:
        "No counted changes in this window, so there is nothing to judge.",
      note: "Try a longer window with --since.",
    });
  });

  it("has no note when the window has changes", () => {
    const report = reportWithParts([
      { id: "t1", path: "src/a", heat: 0.5, containment: 0.5 },
    ]);

    expect(
      deriveVerdict(report, indexTerritories(report.territories)).note,
    ).toBe("");
  });
});
