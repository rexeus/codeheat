import { NodeServices } from "@effect/platform-node";
import { assert, layer } from "@effect/vitest";
import { Effect } from "effect";
import { TestClock } from "effect/testing";

import { analyzeOptionsFor } from "../testing/analyze-options.js";
import { makeTempRepository } from "../testing/temp-repository.js";
import { analyze } from "./analyze.js";

const setNow = TestClock.setTime(Date.parse("2026-06-01T12:00:00Z"));

const day = (number: number): string =>
  `2026-05-${String(number).padStart(2, "0")}T12:00:00Z`;

const code = (version: number): string => `export const value = ${version};\n`;

const filesIn = (
  folder: string,
  version: number,
): Readonly<Record<string, string>> =>
  Object.fromEntries(
    ["a", "b", "c"].map((name) => [`${folder}/${name}.ts`, code(version)]),
  );

layer(NodeServices.layer)("analyze territories of files", (it) => {
  it.effect(
    "names the territory of every file and lists every file once per detail",
    () =>
      Effect.gen(function* () {
        yield* setNow;
        const repo = yield* makeTempRepository;
        yield* repo.commit(day(1), {
          ...filesIn("billing", 1),
          "billing/package.json": "{}\n",
          ...filesIn("web", 1),
          ...filesIn("auth", 1),
        });

        const report = yield* analyze(analyzeOptionsFor(repo));

        const { territories } = report;
        const idOf = (path: string) =>
          territories.nodes.find((node) => node.path === path)?.id;
        assert.strictEqual(territories.recommended, 1);
        assert.deepStrictEqual(
          report.files
            .map(({ path, territory }) => [path, territory])
            .toSorted(([a], [b]) => (a ?? "").localeCompare(b ?? "")),
          [
            ["auth/a.ts", idOf("auth")],
            ["auth/b.ts", idOf("auth")],
            ["auth/c.ts", idOf("auth")],
            ["billing/a.ts", idOf("billing")],
            ["billing/b.ts", idOf("billing")],
            ["billing/c.ts", idOf("billing")],
            ["web/a.ts", idOf("web")],
            ["web/b.ts", idOf("web")],
            ["web/c.ts", idOf("web")],
          ],
        );
        assert.strictEqual(
          territories.nodes.find((node) => node.path === "billing")?.kind,
          "package",
        );
        assert.deepStrictEqual(
          territories.details.map(({ level, ids }) => [level, ids.length]),
          [[1, 3]],
        );
      }),
  );
});

layer(NodeServices.layer)("analyze territories of nothing", (it) => {
  it.effect("has no territories when the universe has no files", () =>
    Effect.gen(function* () {
      yield* setNow;
      const repo = yield* makeTempRepository;
      yield* repo.commit(day(1), { "notes.txt": "hello\n" });

      const report = yield* analyze(analyzeOptionsFor(repo));

      assert.deepStrictEqual(report.territories, {
        recommended: 0,
        details: [],
        nodes: [],
      });
    }),
  );
});
