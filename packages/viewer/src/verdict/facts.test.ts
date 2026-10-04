import type { Report } from "@codeheat/engine";
import { describe, expect, it } from "vitest";

import { indexTerritories } from "../territories/territory-index.js";
import {
  boundaryOn,
  erosionOf,
  reportWithParts,
} from "../testing/design-fit.js";
import type { PartSpec } from "../testing/design-fit.js";
import { deriveVerdict } from "./derive-verdict.js";

const factsOf = (report: Report) =>
  deriveVerdict(report, indexTerritories(report.territories)).facts;

const parts = (leaking: number, holding: number): PartSpec[] => [
  { id: "t1", path: "packages/a", heat: leaking, containment: 0.3 },
  { id: "t2", path: "packages/b", heat: holding, containment: 0.9 },
];

const LEAK_LABEL =
  "territories with enough changes keep at most 75% of their changes inside";

describe("verdict facts", () => {
  const report = reportWithParts(parts(0.6, 0.4), {
    changeRadius: { changes: 40, median: 2, p90: 3, local: 0.6 },
    propagationCost: { cost: 0.25, files: 40 },
    erosion: erosionOf("holding"),
    entryPoints: [
      boundaryOn(1, ["t1"]),
      boundaryOn(2, ["t2"]),
      boundaryOn(3, ["t1"]),
      boundaryOn(4, ["t2"]),
    ],
  });

  it("lists the leaking territories, the weight of the top places, the trend, and the propagation cost", () => {
    expect(factsOf(report)).toEqual([
      {
        value: "1 of 2",
        label: LEAK_LABEL,
        note: "enough: at least 5 counted changes",
      },
      {
        value: "100%",
        label:
          "of the change effort sits in the territories of the top 3 places to start",
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
    const labels = factsOf(report).map(({ label }) => label);

    expect(labels.join(" ")).not.toContain("modules a typical change touches");
  });
});

describe("verdict facts about the top places", () => {
  const report = reportWithParts(parts(0.6, 0.4));

  it("counts a territory once however many top places concern it", () => {
    const single = {
      ...report,
      entryPoints: [boundaryOn(1, ["t1"]), boundaryOn(2, ["t1"])],
    };

    expect(factsOf(single)[1]).toMatchObject({
      value: "60%",
      label:
        "of the change effort sits in the territories of the top 2 places to start",
    });
  });

  it("leaves out what the report does not measure", () => {
    expect(factsOf(reportWithParts(parts(0.6, 0.4)))).toEqual([
      {
        value: "1 of 2",
        label: LEAK_LABEL,
        note: "enough: at least 5 counted changes",
      },
      { value: "No trend yet", label: "over the last quarters", note: "" },
    ]);
  });
});

describe("verdict facts about the leak count", () => {
  it("counts only territories with enough counted changes", () => {
    const sampled = reportWithParts([
      { id: "t1", path: "a", heat: 0.3, containment: 0.1, changes: 12 },
      { id: "t2", path: "b", heat: 0.3, containment: 0.9, changes: 30 },
      { id: "t3", path: "c", heat: 0.3, containment: 0, changes: 2 },
      { id: "t4", path: "d", heat: 0.1, containment: null, changes: 0 },
    ]);

    expect(factsOf(sampled)[0]).toMatchObject({
      value: "1 of 2",
      label: LEAK_LABEL,
    });
  });

  it("counts a territory at exactly the limit as leaking", () => {
    const edge = reportWithParts([
      { id: "t1", path: "a", heat: 0.5, containment: 0.75 },
      { id: "t2", path: "b", heat: 0.5, containment: 0.76 },
    ]);

    expect(factsOf(edge)[0]?.value).toBe("1 of 2");
  });

  it("names a single territory in the singular", () => {
    const one = reportWithParts([
      { id: "t1", path: "a", heat: 0.5, containment: 0.1 },
    ]);

    expect(factsOf(one)[0]?.label).toBe(
      "territory with enough changes keeps at most 75% of its changes inside",
    );
  });
});

describe("verdict facts about the trend", () => {
  const base = reportWithParts(parts(0.6, 0.4));

  it("says in the engine's terms whether a falling trend is significant", () => {
    const falling = { ...base, erosion: erosionOf("eroding") };

    expect(factsOf(falling)[1]).toEqual({
      value: "Getting worse",
      label: "over the last quarters",
      note: "80% → 60% of changes stay in one module (higher is better; this fall is significant)",
    });
  });

  it("calls no trend from fewer quarters than the engine needs, and shows the numbers", () => {
    const short = { ...base, erosion: erosionOf("holding", 3) };

    expect(factsOf(short)[1]).toEqual({
      value: "Too few quarters to call a trend",
      label: "3 of the 5 quarters needed",
      note: "80% → 60% of changes stay in one module (higher is better)",
    });
  });

  it("calls a trend from exactly the quarters the engine needs", () => {
    const enough = { ...base, erosion: erosionOf("holding", 5) };

    expect(factsOf(enough)[1]?.value).toBe("Holding steady");
  });

  it("reads the quarters needed from the report's thresholds", () => {
    const strict = {
      ...base,
      erosion: erosionOf("holding", 8),
      thresholds: { ...base.thresholds, minVerdictWindows: 12 },
    };

    expect(factsOf(strict)[1]).toMatchObject({
      value: "Too few quarters to call a trend",
      label: "8 of the 12 quarters needed",
    });
  });
});
