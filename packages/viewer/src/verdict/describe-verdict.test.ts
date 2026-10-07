import type { Analysis } from "@codeheat/engine";
import { describe, expect, it } from "vitest";

import { parseReport } from "../document/embedded-report.js";
import { standingOf } from "../territories/judgement.js";
import { indexTerritories } from "../territories/territory-index.js";
import { reportWithParts } from "../testing/design-fit.js";
import { reportOf } from "../testing/reports.js";
import { describeVerdict } from "./describe-verdict.js";

/** A report whose engine judged `verdict`; a window with real commits unless `window` says otherwise. */
const judged = (
  verdict: Partial<Analysis["verdict"]>,
  window: Partial<Analysis["window"]> = {},
): Analysis => {
  const report = reportOf([]);
  return {
    ...report,
    window: { ...report.window, ...window },
    verdict: { ...report.verdict, ...verdict },
  };
};

describe("describeVerdict", () => {
  it.each([
    ["holds", "Holds up"],
    ["mixed", "Holds in parts"],
    ["strained", "Under strain"],
  ] as const)(
    "names the level %s the engine judged, with nothing to explain",
    (level, label) => {
      expect(describeVerdict(judged({ level, reason: null }))).toEqual({
        level,
        label,
        reason: "",
        note: "",
      });
    },
  );

  it("says why there is no verdict when too little of the effort can be judged", () => {
    expect(
      describeVerdict(
        judged({ level: "unknown", reason: "too-little-evidence" }),
      ),
    ).toEqual({
      level: "unknown",
      label: "Not enough evidence",
      reason:
        "Too little of the change effort sits in territories with enough changes to judge the design.",
      note: "",
    });
  });

  it("says plainly that a report without territories cannot be judged", () => {
    expect(
      describeVerdict(judged({ level: "unknown", reason: "no-territories" }))
        .reason,
    ).toBe(
      "This report has no territories, so it cannot say whether the design holds; analyze again with a current codeheat.",
    );
  });

  it("gives a window without counted changes as the reason, with when the history last changed", () => {
    const quiet = judged(
      { level: "unknown", reason: "quiet-window" },
      { commits: 0, realCommits: 0, lastCommitAt: null },
    );

    expect(describeVerdict(quiet)).toMatchObject({
      level: "unknown",
      reason:
        "No counted changes in this window, so there is nothing to judge.",
      note: "Try a longer window with --since.",
    });
  });
});

describe("describeVerdict of a report from before the verdict", () => {
  const { verdict: _verdict, ...older } = reportWithParts([
    { id: "t1", path: "packages/core", heat: 0.6, containment: 0.3 },
    { id: "t2", path: "packages/web", heat: 0.4, containment: 0.9 },
  ]);
  const report = parseReport(JSON.stringify(older));

  it("says the report has no verdict, not that it has no territories", () => {
    expect(describeVerdict(report)).toEqual({
      level: "unknown",
      label: "Not enough evidence",
      reason:
        "This report has no verdict; analyze again with a current codeheat.",
      note: "",
    });
  });

  it("calls its territories not judged, not short of a partner", () => {
    const index = indexTerritories(report.territories);

    expect(
      index.recommended.map((territory) => standingOf(territory, report)),
    ).toEqual([
      { kind: "unjudged", reason: "not judged" },
      { kind: "unjudged", reason: "not judged" },
    ]);
  });
});
