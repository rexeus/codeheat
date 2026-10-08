import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem, Path, Schema } from "effect";

import { Analysis } from "../model/analysis.js";
import type { Territory } from "../model/territory.js";
import { Report } from "../report/report.js";
import { analysisRecord } from "../testing/analysis-record.js";
import { fileRecord } from "../testing/file-record.js";
import { fitRecord, territoryRecord } from "../testing/territory-record.js";
import { reportOf } from "./report-of.js";

const readSample = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const location = yield* path.fromFileUrl(
    new URL("../../../../fixtures/report.sample.json", import.meta.url),
  );
  const json: unknown = JSON.parse(yield* fs.readFileString(location));
  return yield* Schema.decodeUnknownEffect(Analysis)(json);
});

const leaksTo = (territory: string) => ({
  containment: 0.5,
  partner: { territory, sharedChanges: 6, share: 0.3 },
});

/** A real area `id` at `src/<id>` with `heat` of all the heat and 20 changes. */
const area = (
  id: string,
  heat: number,
  fit: Partial<NonNullable<Territory["fit"]>>,
  overrides: Partial<Territory> = {},
): Territory => ({
  ...territoryRecord(id, "folder", "root"),
  path: `src/${id}`,
  changes: 20,
  heatShare: heat,
  fit: fitRecord(fit),
  ...overrides,
});

/**
 * Areas of every standing: `hot` leaks into the cold `cold`, `quiet` has too
 * few changes but holds the hottest file, `lone` keeps little inside with no
 * partner, `small` is too cold to list, and a bucket and test code sit at the
 * same detail.
 */
const VARIED = analysisRecord({
  generatedAt: "2026-06-01T12:00:00.000Z",
  repository: { name: "shop", head: "abc123", scope: ".", shallow: false },
  window: {
    since: "2025-06-01T12:00:00.000Z",
    until: "2026-06-01T12:00:00.000Z",
    commits: 160,
    realCommits: 150,
    couplingCommits: 140,
    lastCommitAt: "2026-05-30T08:00:00.000Z",
  },
  logicalChanges: { by: "pr", count: 145, largest: 3 },
  territories: {
    recommended: 1,
    details: [
      {
        level: 1,
        ids: [
          "hot",
          "lone",
          "holds",
          "quiet",
          "cold",
          "small",
          "rest",
          "tests",
        ],
      },
    ],
    nodes: [
      { ...territoryRecord("root", "folder", null), path: "." },
      area("hot", 0.4567, leaksTo("cold")),
      area("lone", 0.2222, { containment: 0.3 }),
      area("holds", 0.1111, { containment: 0.9 }, { kind: "package" }),
      area("quiet", 0.0055, { containment: 1 }, { changes: 2 }),
      area("cold", 0.0033, { containment: 0.8 }, { changes: 3 }),
      area("small", 0.0044, { containment: 0.9 }, { changes: 4 }),
      { ...area("rest", 0.1789, {}), kind: "other", path: "src" },
      {
        ...area("tests", 0.0179, {}),
        kind: "tests",
        path: "test",
        testFiles: 1,
      },
    ],
  },
  files: [
    fileRecord("src/quiet/engine.ts", "quiet", { changes: 30, loc: 900 }),
    fileRecord("src/hot/a.ts", "hot", { changes: 9 }),
    fileRecord("src/loose.ts", "rest", { changes: 8 }),
    fileRecord("test/a.test.ts", "tests", { changes: 40, test: true }),
  ],
});

/** Area names the report uses that name no listed area. */
const danglingNames = (report: Report): ReadonlyArray<string> => {
  const listed = new Set(report.areas.map(({ path }) => path));
  return [
    ...report.areas.flatMap(({ leaksInto }) => leaksInto?.path ?? []),
    ...report.hotspots.flatMap(({ area: name }) => name ?? []),
  ].filter((name) => !listed.has(name));
};

/** The heat of the listed areas and the rest in tenths of a percent, counted exactly. */
const heatTenths = (report: Report): number =>
  [...report.areas.map(({ heat }) => heat), report.basis.rest.heat].reduce(
    (sum, heat) => sum + Math.round(heat * 10),
    0,
  );

/** Areas whose `note` does not say exactly that their `stays` is null. */
const notesAmiss = (report: Report): ReadonlyArray<string> =>
  report.areas
    .filter(({ stays, note }) => (stays === null) !== (note !== undefined))
    .map(({ path }) => path);

describe("reportOf", () => {
  it("names the repository and the window in days, with the changes it counts", () => {
    const report = reportOf(VARIED);

    expect(report.schemaVersion).toBe(2);
    expect(report.repository).toEqual({
      name: "shop",
      head: "abc123",
      analyzedAt: "2026-06-01T12:00:00.000Z",
    });
    expect(report.window).toEqual({
      since: "2025-06-01",
      until: "2026-06-01",
      changes: 140,
      lastCommitAt: "2026-05-30",
    });
  });

  it("lists the area of a hotspot and the area a leak goes to, and no other cold one", () => {
    const report = reportOf(VARIED);

    expect(report.areas.map(({ path, note }) => [path, note])).toEqual([
      ["src/hot", undefined],
      ["src/lone", "no-partner"],
      ["src/holds", undefined],
      ["src/quiet", "few-changes"],
      ["src/cold", "few-changes"],
    ]);
    expect(report.hotspots.map(({ path, area: name }) => [path, name])).toEqual(
      [
        ["src/quiet/engine.ts", "src/quiet"],
        ["src/hot/a.ts", "src/hot"],
        ["src/loose.ts", null],
      ],
    );
    expect(report.basis.rest).toEqual({
      areas: 1,
      files: 2,
      heat: 20.1,
      largest: { path: "src", heat: 17.9 },
    });
  });
});

describe("reportOf invariants on areas of every standing", () => {
  const report = reportOf(VARIED);

  it("names no area it does not list", () => {
    expect(danglingNames(report)).toEqual([]);
  });

  it("adds the heat of the listed areas and the rest up to exactly 100.0", () => {
    expect(heatTenths(report)).toBe(1000);
  });

  it("gives a note exactly to the areas whose stays is null", () => {
    expect(notesAmiss(report)).toEqual([]);
  });

  it("projects onto a document that decodes as report v2", () => {
    expect(Schema.decodeSync(Report)(report)).toEqual(report);
  });
});

describe("reportOf invariants on fixtures/report.sample.json", () => {
  it.effect(
    "names only listed areas, adds up to 100, and notes every null stays",
    () =>
      Effect.gen(function* () {
        const report = reportOf(yield* readSample);

        expect(report.areas).toHaveLength(5);
        expect(danglingNames(report)).toEqual([]);
        expect(heatTenths(report)).toBe(1000);
        expect(notesAmiss(report)).toEqual([]);
      }).pipe(Effect.provide(NodeServices.layer)),
  );
});
