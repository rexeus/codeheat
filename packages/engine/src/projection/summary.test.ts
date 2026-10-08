import { describe, expect, it } from "vitest";

import type { Analysis } from "../model/analysis.js";
import { NO_DESIGN_FINDINGS } from "../testing/report-defaults.js";
import { summaryOf } from "./summary.js";

type Verdict = Analysis["verdict"];

/** The parts the sentence reads: `verdict` over a window of `changes` counted changes. */
const partsOf = (
  verdict: Partial<Verdict>,
  changes = 120,
): Pick<Analysis, "verdict" | "window"> => ({
  verdict: { ...NO_DESIGN_FINDINGS.verdict, reason: null, ...verdict },
  window: {
    since: "2025-06-01T12:00:00.000Z",
    until: "2026-06-01T12:00:00.000Z",
    commits: changes,
    realCommits: changes,
    couplingCommits: changes,
    lastCommitAt: null,
  },
});

describe("summaryOf", () => {
  it("names the level and the percent of the change effort in leaking areas", () => {
    expect(
      summaryOf(partsOf({ level: "strained", leakShare: 0.6524 }), null, 0),
    ).toBe("Under strain: 65% of the change effort sits in areas that leak.");
  });

  it.each([
    ["holding", "Holds up, holding steady"],
    ["eroding", "Holds up, getting worse"],
    ["improving", "Holds up, getting better"],
  ] as const)("names a %s trend after the level", (trend, lead) => {
    expect(
      summaryOf(partsOf({ level: "holds", leakShare: 0.1, trend }), null, 0),
    ).toBe(`${lead}: 10% of the change effort sits in areas that leak.`);
  });
});

describe("summaryOf on thin evidence", () => {
  it.each([
    ["few-changes", 1, "judged on only 1 change"],
    ["few-changes", 45, "judged on only 45 changes"],
    ["shallow", 120, "judged on a shallow clone"],
  ] as const)(
    "says why the evidence is thin (%s, %i changes)",
    (thin, changes, words) => {
      expect(
        summaryOf(
          partsOf(
            { level: "mixed", leakShare: 0.3, trend: "unknown" },
            changes,
          ),
          thin,
          0,
        ),
      ).toBe(
        `Holds in parts: 30% of the change effort sits in areas that leak, ${words}.`,
      );
    },
  );

  it("counts the judged areas when there are too few of them", () => {
    expect(
      summaryOf(
        partsOf({ level: "holds", leakShare: 0, judged: ["t1"] }),
        "few-areas",
        0,
      ),
    ).toBe(
      "Holds up: 0% of the change effort sits in areas that leak, judged on only 1 area.",
    );
  });

  it.each([
    ["no-territories", "the repository has no files to judge."],
    [
      "quiet-window",
      "no counted changes in this window, so there is nothing to judge.",
    ],
    [
      "too-little-evidence",
      "too little of the change effort sits in areas codeheat can judge; 53.7% is in loose files and other unlisted areas (see basis.rest).",
    ],
  ] as const)("says why there is no level (%s)", (reason, why) => {
    expect(
      summaryOf(partsOf({ level: "unknown", reason }), "no-level", 53.7),
    ).toBe(`Not enough evidence: ${why}`);
  });
});
