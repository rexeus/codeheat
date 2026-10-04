import { describe, expect, it } from "vitest";

import { territoryFit, territoryNode } from "../testing/reports.js";
import { standingOf } from "./judgement.js";

const LIMITS = {
  maxCommitFiles: 50,
  minModuleCommits: 5,
  maxEntryContainment: 0.75,
};

const PARTNER = { territory: "t9", sharedChanges: 4, share: 0.2 };

const standing = (containment: number | null, overrides = {}) =>
  standingOf(
    territoryNode("t1", "src/a", {
      changes: 20,
      fit: territoryFit({ containment, partner: PARTNER }),
      ...overrides,
    }),
    LIMITS,
  );

describe("standingOf", () => {
  it("calls a territory leaking at the limit, and holding above it", () => {
    expect(standing(0.75)).toEqual({ kind: "leaks", containment: 0.75 });
    expect(standing(0.76)).toEqual({ kind: "holds", containment: 0.76 });
  });

  it("does not judge a territory that keeps little inside but has no partner to leak to", () => {
    expect(
      standing(0.2, { fit: territoryFit({ containment: 0.2, partner: null }) }),
    ).toEqual({ kind: "unjudged", reason: "no partner to leak to" });
  });

  it.each([
    ["test code", { kind: "tests" }],
    ["leftover files", { kind: "other" }],
    ["too few changes", { changes: 4 }],
    ["only in changes of over 50 files", { changes: 0, heatShare: 0.1 }],
  ] as const)("does not judge %s", (reason, overrides) => {
    expect(standing(0.5, overrides)).toEqual({ kind: "unjudged", reason });
  });

  it("does not judge a territory without counted changes", () => {
    expect(standing(null)).toEqual({
      kind: "unjudged",
      reason: "no counted changes",
    });
  });
});
