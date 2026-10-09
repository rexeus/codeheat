import { NodeServices } from "@effect/platform-node";
import { assert, layer } from "@effect/vitest";
import { Effect } from "effect";
import { TestClock } from "effect/testing";

import { reportOf } from "../projection/report-of.js";
import { analyzeOptionsFor } from "../testing/analyze-options.js";
import { makeTempRepository } from "../testing/temp-repository.js";
import { analyze } from "./analyze.js";

const setNow = TestClock.setTime(Date.parse("2026-06-01T12:00:00Z"));

const day = (number: number): string =>
  `2026-05-${String(number).padStart(2, "0")}T12:00:00Z`;

const code = (version: number): string =>
  `export const value = ${version};\nif (value) {\n  run(value);\n}\n`;

const filesIn = (folder: string, version: number) =>
  Object.fromEntries(
    ["a", "b", "c"].map((name) => [`${folder}/${name}.ts`, code(version)]),
  );

layer(NodeServices.layer)("analyze loose files", (it) => {
  it.effect(
    "judges the loose files of a directory whose folders are areas as one area named by their glob",
    () =>
      Effect.gen(function* () {
        yield* setNow;
        const repo = yield* makeTempRepository;
        // src holds 9 of the 12 files, so it splits into x, y, and its own files
        yield* repo.commit(day(1), {
          ...filesIn("src", 1),
          ...filesIn("src/x", 1),
          ...filesIn("src/y", 1),
          ...filesIn("app", 1),
        });
        for (const version of [2, 3, 4, 5, 6, 7]) {
          yield* repo.commit(day(version), { "src/a.ts": code(version) });
          yield* repo.commit(day(version + 7), {
            "src/x/a.ts": code(version),
          });
          yield* repo.commit(day(version + 14), {
            "src/y/a.ts": code(version),
            "app/a.ts": code(version),
          });
        }

        const analysis = yield* analyze(analyzeOptionsFor(repo));
        const report = reportOf(analysis);

        const loose = analysis.territories.nodes.find(
          ({ kind }) => kind === "files",
        );
        // the first commit touched every area, the six that changed src/a.ts alone stayed inside
        assert.deepStrictEqual(
          [loose?.path, loose?.files, loose?.changes],
          ["src/*", 3, 7],
        );
        assert.include(analysis.verdict.judged, loose?.id);
        const area = report.areas.find(({ path }) => path === "src/*");
        assert.deepStrictEqual(
          [area?.description, area?.files, area?.changes, area?.stays],
          ["files in src; main files: a, b, c", 3, 7, 0.86],
        );
      }),
  );
});
