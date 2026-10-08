import { describe, expect, it } from "vitest";

import type { Territories, Territory } from "../model/territory.js";
import { DEFAULT_THRESHOLDS } from "../testing/report-defaults.js";
import { fitRecord, territoryRecord } from "../testing/territory-record.js";
import { areasOf } from "./areas-of.js";

/** A territory at the recommended detail: `heat` of all the heat, 20 changes, and the fit given. */
type PartSpec = {
  readonly id: string;
  readonly heat: number;
  readonly kind?: Territory["kind"];
  readonly changes?: number;
  readonly files?: number;
  readonly testFiles?: number;
  readonly fit?: Partial<NonNullable<Territory["fit"]>>;
};

/** The repository "." split into `parts`, all at detail 1, the recommended one. */
const territoriesOf = (parts: ReadonlyArray<PartSpec>): Territories => ({
  recommended: 1,
  details: [{ level: 1, ids: parts.map(({ id }) => id) }],
  nodes: [
    { ...territoryRecord("root", "folder", null), path: "." },
    ...parts.map((part): Territory => ({
      ...territoryRecord(part.id, part.kind ?? "folder", "root"),
      path: `src/${part.id}`,
      changes: part.changes ?? 20,
      files: part.files ?? 4,
      testFiles: part.testFiles ?? 0,
      heatShare: part.heat,
      fit: fitRecord(part.fit),
    })),
  ],
});

const areasFor = (
  parts: ReadonlyArray<PartSpec>,
  named: ReadonlyArray<string> = [],
) =>
  areasOf(
    { territories: territoriesOf(parts), thresholds: DEFAULT_THRESHOLDS },
    new Set(named),
  );

const leaksTo = (territory: string, sharedChanges: number) => ({
  containment: 0.4,
  partner: { territory, sharedChanges, share: 0.3 },
});

/** A line through a territory's containment over the series that the gate judged `verdict`. */
const erosion = (verdict: "eroding" | "improving" | "holding") => ({
  from: 0.8,
  to: 0.6,
  slope: -0.05,
  verdict,
  windows: 6,
  cohesion: [],
  recent: true,
});

describe("areasOf listing", () => {
  it("lists judged areas and areas with 1% of the heat, the hottest first, and sums up the others", () => {
    const { areas, rest } = areasFor([
      { id: "cold-judged", heat: 0.005, fit: { containment: 0.9 } },
      { id: "warm", heat: 0.3, changes: 2 },
      { id: "edge", heat: 0.01, changes: 2 },
      { id: "cold", heat: 0.009, changes: 2, files: 3 },
      { id: "bucket", heat: 0.676, kind: "other", files: 7 },
    ]);

    expect(areas.map(({ path }) => path)).toEqual([
      "src/warm",
      "src/edge",
      "src/cold-judged",
    ]);
    expect(rest).toEqual({ areas: 1, files: 10, heat: 68.5 });
  });

  it("lists an area the report names elsewhere, and one a listed area leaks into, however cold", () => {
    const { areas, rest } = areasFor(
      [
        { id: "a", heat: 0.5, fit: leaksTo("b", 6) },
        { id: "b", heat: 0.002, changes: 2 },
        { id: "c", heat: 0.003, changes: 2 },
        { id: "d", heat: 0.004, changes: 2 },
      ],
      ["c"],
    );

    expect(areas.map(({ path }) => path)).toEqual(["src/a", "src/c", "src/b"]);
    expect(areas[0]?.leaksInto).toEqual({ path: "src/b", changes: 6 });
    expect(rest.areas).toBe(1);
  });

  it("breaks a tie in heat by path", () => {
    const { areas } = areasFor([
      { id: "b", heat: 0.5, changes: 2 },
      { id: "a", heat: 0.5, changes: 2 },
    ]);

    expect(areas.map(({ path }) => path)).toEqual(["src/a", "src/b"]);
  });
});

describe("areasOf area", () => {
  it("states how much a judged area keeps inside, with no note", () => {
    const [area] = areasFor([
      {
        id: "a",
        heat: 1,
        files: 9,
        testFiles: 4,
        fit: { containment: 0.8333 },
      },
    ]).areas;

    expect(area).toEqual({
      path: "src/a",
      description: "a",
      files: 5,
      changes: 20,
      heat: 100,
      stays: 0.83,
    });
  });

  it.each([
    [
      "too few changes",
      { changes: 4, fit: { containment: 0.9 } },
      "few-changes",
    ],
    ["no containment", { fit: { containment: null } }, "few-changes"],
    ["a leak with no partner", { fit: { containment: 0.75 } }, "no-partner"],
  ] as const)("says why an area with %s is not judged", (_, spec, note) => {
    const [area] = areasFor([{ id: "a", heat: 0.5, ...spec }]).areas;

    expect(area?.stays).toBeNull();
    expect(area?.note).toBe(note);
    expect(area?.leaksInto).toBeUndefined();
  });
});

describe("areasOf leaks and trends", () => {
  it("names where a leaking area leaks to, and no partner of an area that holds", () => {
    const holding = {
      containment: 0.9,
      partner: { territory: "a", sharedChanges: 4, share: 0.2 },
    };
    const { areas } = areasFor([
      { id: "a", heat: 0.5, fit: leaksTo("b", 7) },
      { id: "b", heat: 0.4, fit: holding },
    ]);

    expect(areas.map(({ leaksInto }) => leaksInto)).toEqual([
      { path: "src/b", changes: 7 },
      undefined,
    ]);
  });

  it("gives a trend only when it moved, and the chronic hotspots only when there are any", () => {
    const { areas } = areasFor([
      {
        id: "a",
        heat: 0.4,
        fit: { containment: 0.9, erosion: erosion("eroding"), chronicFiles: 2 },
      },
      {
        id: "b",
        heat: 0.3,
        fit: { containment: 0.9, erosion: erosion("improving") },
      },
      {
        id: "c",
        heat: 0.2,
        fit: { containment: 0.9, erosion: erosion("holding") },
      },
    ]);

    expect(areas.map(({ trend, hotspots }) => [trend, hotspots])).toEqual([
      ["eroding", 2],
      ["improving", undefined],
      [undefined, undefined],
    ]);
  });
});
