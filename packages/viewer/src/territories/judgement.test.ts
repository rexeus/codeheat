import type { Report } from "@codeheat/engine";
import { describe, expect, it } from "vitest";

import { reportOf, territoryFit, territoryNode } from "../testing/reports.js";
import { standingOf } from "./judgement.js";

const PARTNER = { territory: "t9", sharedChanges: 4, share: 0.2 };

/** The verdict and limits of a report whose engine judged `judged` and found `leaking` among them. */
const judgedAs = (
  judged: readonly string[],
  leaking: readonly string[] = [],
): Pick<Report, "verdict" | "thresholds"> => {
  const report = reportOf([]);
  return {
    thresholds: report.thresholds,
    verdict: { ...report.verdict, judged, leaking },
  };
};

const territory = (containment: number | null, overrides = {}) =>
  territoryNode("t1", "src/a", {
    changes: 20,
    fit: territoryFit({ containment, partner: PARTNER }),
    ...overrides,
  });

describe("standingOf", () => {
  it("reads leaking and holding territories from the verdict, with their containment", () => {
    expect(standingOf(territory(0.75), judgedAs(["t1"], ["t1"]))).toEqual({
      kind: "leaks",
      containment: 0.75,
    });
    expect(standingOf(territory(0.76), judgedAs(["t1"]))).toEqual({
      kind: "holds",
      containment: 0.76,
    });
  });

  it("names a territory the verdict did not judge that keeps little inside as having no partner to leak to", () => {
    expect(
      standingOf(
        territory(0.2, {
          fit: territoryFit({ containment: 0.2, partner: null }),
        }),
        judgedAs([]),
      ),
    ).toEqual({ kind: "unjudged", reason: "no partner to leak to" });
  });

  it.each([
    ["test code", { kind: "tests" }],
    ["leftover files", { kind: "other" }],
    ["too few changes", { changes: 4 }],
    ["only in changes of over 50 files", { changes: 0, heatShare: 0.1 }],
  ] as const)("says why it does not judge %s", (reason, overrides) => {
    expect(standingOf(territory(0.5, overrides), judgedAs([]))).toEqual({
      kind: "unjudged",
      reason,
    });
  });

  it("says why it does not judge a territory without counted changes", () => {
    expect(standingOf(territory(null), judgedAs([]))).toEqual({
      kind: "unjudged",
      reason: "no counted changes",
    });
  });
});
