import { describe, expect, it } from "vitest";

import type { Heat } from "../model/heat.js";
import type { TerritoryFit } from "../model/territory-fit.js";
import { fileRecord } from "../testing/file-record.js";
import { DEFAULT_THRESHOLDS } from "../testing/report-defaults.js";
import { fitRecord, territoryRecord } from "../testing/territory-record.js";
import { fileHeatOf } from "./file-heat.js";
import { hotspotEntries } from "./hotspot.js";
import type { HotspotPlaces } from "./hotspot.js";
import type { Judged } from "./judged-territories.js";

const NODES = [
  territoryRecord("r"),
  territoryRecord("a", "package", "r", ["a1"]),
  territoryRecord("a1", "folder", "a"),
  territoryRecord("b", "package", "r"),
];

const judged = (
  id: string,
  heatShare: number,
  fit: Partial<TerritoryFit>,
): Judged => ({
  ...territoryRecord(id, "package", "r"),
  heatShare,
  fit: fitRecord(fit),
});

const chronic: Heat = { kind: "chronic", hotWindows: 6, windows: 8 };

/** Three files of no territory of interest that hold 4500 of the 6000 units of heat once a 1500-unit hotspot is added. */
const FILLER = ["f1", "f2", "f3"].map((name) =>
  fileRecord(`z/${name}.ts`, "b"),
);

const entries = (
  territories: ReadonlyArray<Judged>,
  files: HotspotPlaces["files"],
) =>
  hotspotEntries(
    territories,
    { files, nodes: NODES, heat: fileHeatOf([...files, ...FILLER]) },
    DEFAULT_THRESHOLDS,
  );

describe("hotspotEntries", () => {
  it("scores the share of all the heat that sits in the chronic hotspots, more with fixes, whatever the territory's heat share", () => {
    const [entry] = entries(
      [
        judged("a", 0.4, {
          chronicShare: 0.5,
          chronicFiles: 1,
          fixDensity: { fixes: 5, share: 0.25, spanning: 0 },
        }),
      ],
      [fileRecord("a/x.ts", "a", { heat: chronic })],
    );

    // one 1500-unit hotspot of 6000 units: 0.25, times 1.25 for the fixes
    expect(entry?.score).toBeCloseTo(0.3125, 10);
    expect(entry?.kind).toBe("hotspot");
    expect(entry?.territories).toStrictEqual(["a"]);
    expect(entry?.evidence).toStrictEqual({
      chronicHeatShare: 0.25,
      chronicShare: 0.5,
      chronicFiles: 1,
      fixShare: 0.25,
    });
  });

  it("names the chronic hotspots of the territory, below it included, hottest first, at most five", () => {
    const files = [
      fileRecord("a/low.ts", "a", { heat: chronic, score: 0.1 }),
      ...["1", "2", "3", "4"].map((name, index) =>
        fileRecord(`a/sub/${name}.ts`, "a1", {
          heat: chronic,
          score: 0.9 - index / 10,
        }),
      ),
      fileRecord("a/other.ts", "a", { score: 1 }),
      fileRecord("b/far.ts", "b", { heat: chronic, score: 1 }),
    ];

    const [entry] = entries([judged("a", 0.4, { chronicShare: 0.6 })], files);

    expect(entry?.files).toStrictEqual([
      "a/sub/1.ts",
      "a/sub/2.ts",
      "a/sub/3.ts",
      "a/sub/4.ts",
      "a/low.ts",
    ]);
    expect(entry?.designMove).toBe(
      "Split a hotspot: break a/sub/1.ts, a/sub/2.ts, a/sub/3.ts, and 2 more into parts that each change for one reason.",
    );
    expect(entry?.verdict).toBe(
      "Chronic hotspot: the same files stay among the hottest quarter after quarter.",
    );
  });
});

describe("hotspotEntries gates", () => {
  it("leaves out a territory that is not chronic or holds under two percent of the heat", () => {
    expect(
      entries(
        [
          judged("a", 0.4, { chronicShare: 0.49 }),
          judged("b", 0.0199, { chronicShare: 1 }),
        ],
        [fileRecord("a/x.ts", "a", { heat: chronic })],
      ),
    ).toStrictEqual([]);
  });
});
