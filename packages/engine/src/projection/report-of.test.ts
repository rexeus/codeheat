import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem, Path, Schema } from "effect";

import { Analysis } from "../model/analysis.js";
import { Report } from "../report/report.js";
import { analysisRecord } from "../testing/analysis-record.js";
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

const SHOP = analysisRecord({
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
});

describe("reportOf", () => {
  it("names the repository and the window in days, with the changes it counts", () => {
    const report = reportOf(SHOP);

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

  it("projects onto a document that decodes as report v2", () => {
    const report = reportOf(SHOP);

    expect(Schema.decodeSync(Report)(report)).toEqual(report);
  });

  it.effect(
    "projects fixtures/report.sample.json onto a document that decodes as report v2",
    () =>
      Effect.gen(function* () {
        const report = reportOf(yield* readSample);

        expect(yield* Schema.decodeEffect(Report)(report)).toEqual(report);
        expect(report.answer.summary).toBe(
          "Under strain, getting worse: 100% of the change effort sits in areas that leak.",
        );
      }).pipe(Effect.provide(NodeServices.layer)),
  );
});
