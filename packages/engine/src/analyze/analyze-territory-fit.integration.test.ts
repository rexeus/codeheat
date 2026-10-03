import { NodeServices } from "@effect/platform-node";
import { assert, layer } from "@effect/vitest";
import { Effect } from "effect";
import { TestClock } from "effect/testing";

import type { Report } from "../report/report.js";
import { analyzeOptionsFor } from "../testing/analyze-options.js";
import { lines } from "../testing/logical-changes.js";
import { makeTempRepository } from "../testing/temp-repository.js";
import type { TempRepository } from "../testing/temp-repository.js";
import { analyze } from "./analyze.js";

const setNow = TestClock.setTime(Date.parse("2026-06-01T12:00:00Z"));

const day = (number: number): string =>
  `2026-05-${String(number).padStart(2, "0")}T12:00:00Z`;

const FOLDERS = ["auth", "billing", "web"];

const filesOfChange = (version: number): ReadonlyArray<string> => {
  if (version < 6) {
    return ["billing/a.ts"];
  }
  return version < 12 ? ["billing/b.ts", "web/a.ts"] : ["auth/a.ts"];
};

/**
 * Three folders of three files. Counted changes: six touch billing alone,
 * six touch billing and web together (the first three of them fixes), five
 * touch auth alone.
 */
const buildHistory = (repo: TempRepository) =>
  Effect.gen(function* () {
    yield* repo.commit(
      "2024-01-01T12:00:00Z",
      Object.fromEntries(
        FOLDERS.flatMap((folder) =>
          ["a", "b", "c"].map((name) => [
            `${folder}/${name}.ts`,
            lines(3, name),
          ]),
        ),
      ),
    );
    for (let version = 0; version < 17; version += 1) {
      const files = filesOfChange(version);
      yield* repo.commit(
        day(version + 1),
        Object.fromEntries(
          files.map((file) => [file, lines(4 + version, file)]),
        ),
        version >= 6 && version < 9 ? "fix: repair" : "feat: change",
      );
    }
  });

const summarize = (territories: Report["territories"]) =>
  Object.fromEntries(
    territories.nodes.map(({ path, fit }) => [
      path,
      fit === null
        ? null
        : {
            containment: fit.containment,
            radius: fit.radius,
            partner:
              territories.nodes.find(({ id }) => id === fit.partner?.territory)
                ?.path ?? null,
            fixes: fit.fixDensity?.fixes ?? null,
          },
    ]),
  );

layer(NodeServices.layer)("analyze territory fit", (it) => {
  it.effect(
    "measures how well each territory holds its changes, the partner they reach, and the fixes among them",
    () =>
      Effect.gen(function* () {
        yield* setNow;
        const repo = yield* makeTempRepository;
        yield* buildHistory(repo);

        const { territories } = yield* analyze(analyzeOptionsFor(repo));

        const fits = summarize(territories);
        assert.strictEqual(fits["."], null);
        assert.deepStrictEqual(
          FOLDERS.map((folder) => [folder, fits[folder]]),
          [
            [
              "auth",
              {
                containment: 1,
                radius: 1,
                partner: null,
                fixes: 0,
              },
            ],
            [
              "billing",
              {
                containment: 0.5,
                radius: 1,
                partner: "web",
                fixes: 3,
              },
            ],
            [
              "web",
              {
                containment: 0,
                radius: 2,
                partner: "billing",
                fixes: 3,
              },
            ],
          ],
        );
      }),
  );
});
