import { describe, expect, it } from "vitest";

import type { Analysis } from "../model/analysis.js";
import { analysisRecord } from "../testing/analysis-record.js";
import { NO_DESIGN_FINDINGS } from "../testing/report-defaults.js";
import { answerOf } from "./answer-of.js";

const analysisOf = (verdict: Partial<Analysis["verdict"]>): Analysis => {
  const base = analysisRecord();
  return {
    ...base,
    window: { ...base.window, couplingCommits: 250 },
    verdict: { ...NO_DESIGN_FINDINGS.verdict, ...verdict },
  };
};

describe("answerOf", () => {
  it("answers with the level, the leaking heat as a percent, and the trend, on strong evidence", () => {
    const answer = answerOf(
      analysisOf({
        level: "mixed",
        reason: null,
        leakShare: 0.3125,
        judged: ["t1", "t2", "t3"],
        trend: "holding",
      }),
      0,
    );

    expect(answer).toEqual({
      level: "mixed",
      summary:
        "Holds in parts, holding steady: 31% of the change effort sits in areas that leak.",
      leakingHeat: 31.2,
      trend: "holding",
      evidence: "strong",
    });
  });
});

describe("answerOf at the cut points", () => {
  it.each([
    {
      leakShare: 0.1995,
      level: "holds",
      sentence: "Holds up: 19%",
      heat: 19.9,
    },
    {
      leakShare: 0.4995,
      level: "mixed",
      sentence: "Holds in parts: 49%",
      heat: 49.9,
    },
  ] as const)(
    "rounds a leak share of $leakShare down, below the cut point the level stayed below",
    ({ leakShare, level, sentence, heat }) => {
      const answer = answerOf(
        analysisOf({
          level,
          reason: null,
          leakShare,
          judged: ["t1", "t2", "t3"],
          trend: "unknown",
        }),
        0,
      );

      expect([answer.leakingHeat, answer.summary]).toEqual([
        heat,
        `${sentence} of the change effort sits in areas that leak.`,
      ]);
    },
  );
});

describe("answerOf without a level", () => {
  it("says no-files for an analysis without territories", () => {
    const answer = answerOf(
      analysisOf({
        level: "unknown",
        reason: "no-territories",
        trend: "unknown",
      }),
      0,
    );

    expect([answer.reason, answer.summary]).toEqual([
      "no-files",
      "Not enough evidence: the repository has no files to judge.",
    ]);
  });

  it("gives the reason and no leaking heat for an unknown level, on thin evidence", () => {
    const answer = answerOf(
      analysisOf({
        level: "unknown",
        reason: "quiet-window",
        trend: "unknown",
      }),
      0,
    );

    expect(answer).toEqual({
      level: "unknown",
      summary:
        "Not enough evidence: no counted changes in this window, so there is nothing to judge.",
      leakingHeat: null,
      trend: "unknown",
      evidence: "thin",
      reason: "quiet-window",
    });
  });
});
