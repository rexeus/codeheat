import { describe, expect, it } from "vitest";

import type { Analysis } from "../model/analysis.js";
import { analysisRecord } from "../testing/analysis-record.js";
import { NO_DESIGN_FINDINGS } from "../testing/report-defaults.js";
import { thinEvidenceOf } from "./evidence.js";

/** A strained verdict on `judged` territories, over `changes` counted changes. */
const analysisOf = ({
  judged = ["t1", "t2", "t3"],
  changes = 100,
  shallow = false,
  level = "strained",
}: {
  readonly judged?: ReadonlyArray<string>;
  readonly changes?: number;
  readonly shallow?: boolean;
  readonly level?: Analysis["verdict"]["level"];
}): Analysis => {
  const base = analysisRecord();
  return {
    ...base,
    repository: { ...base.repository, shallow },
    window: { ...base.window, couplingCommits: changes },
    verdict: {
      ...NO_DESIGN_FINDINGS.verdict,
      level,
      reason: level === "unknown" ? "too-little-evidence" : null,
      judged,
    },
  };
};

describe("thinEvidenceOf", () => {
  it("finds strong evidence in 100 changes over 3 judged territories of a full clone", () => {
    expect(thinEvidenceOf(analysisOf({}))).toBeNull();
  });

  it("finds thin evidence without a level, whatever the counts", () => {
    expect(thinEvidenceOf(analysisOf({ level: "unknown" }))).toBe("no-level");
  });

  it("finds thin evidence in fewer than 100 changes", () => {
    expect(thinEvidenceOf(analysisOf({ changes: 99 }))).toBe("few-changes");
  });

  it("finds thin evidence in fewer than 3 judged territories", () => {
    expect(thinEvidenceOf(analysisOf({ judged: ["t1", "t2"] }))).toBe(
      "few-areas",
    );
  });

  it("finds thin evidence in a shallow clone, whose counts fall short", () => {
    expect(thinEvidenceOf(analysisOf({ shallow: true }))).toBe("shallow");
  });

  it("names the missing changes first when the evidence is thin for several reasons", () => {
    expect(
      thinEvidenceOf(
        analysisOf({ changes: 40, judged: ["t1"], shallow: true }),
      ),
    ).toBe("few-changes");
  });
});
