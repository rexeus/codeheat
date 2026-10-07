import { describe, expect, it } from "vitest";

import { analysisRecord } from "../testing/analysis-record.js";
import { basisOf } from "./basis-of.js";

describe("basisOf", () => {
  it("states the limits of the answer under their v2 names, the shares of all the heat as percents", () => {
    const { thresholds } = basisOf(analysisRecord(), {
      areas: 0,
      files: 0,
      heat: 0,
    });

    expect(thresholds).toEqual({
      leaksAtStays: 0.75,
      judgedFromChanges: 5,
      mixedFromLeakingHeat: 20,
      strainedFromLeakingHeat: 50,
      judgedHeatNeeded: 50,
      pairFromChanges: 3,
      pairFromStrength: 0.3,
      maxChangeFiles: 50,
      thinBelowChanges: 100,
      thinBelowAreas: 3,
    });
  });

  it("counts the mechanical commits of every kind, the changes too large to count, and the generated files", () => {
    const base = analysisRecord();
    const rest = { areas: 2, files: 9, heat: 4.5 };
    const basis = basisOf(
      {
        ...base,
        window: { ...base.window, couplingCommits: 90 },
        mechanicalCommits: {
          ignored: 1,
          renames: 2,
          whitespace: 3,
          reverts: 4,
          duplicates: 5,
        },
        logicalChanges: { by: "pr", count: 97, largest: 6 },
        totals: { ...base.totals, generated: 8 },
      },
      rest,
    );

    expect(basis.excluded).toEqual({
      mechanicalCommits: 15,
      largeChanges: 7,
      generated: 8,
    });
    expect(basis.rest).toBe(rest);
  });
});
