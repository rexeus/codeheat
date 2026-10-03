import { NodeServices } from "@effect/platform-node";
import { assert, layer } from "@effect/vitest";
import { Effect } from "effect";
import { TestClock } from "effect/testing";

import { analyzeOptionsFor } from "../testing/analyze-options.js";
import { lines } from "../testing/logical-changes.js";
import {
  commitQuarters,
  createFiles,
  repeated,
  touching,
} from "../testing/quarters.js";
import type { Change } from "../testing/quarters.js";
import { makeTempRepository } from "../testing/temp-repository.js";
import { analyze } from "./analyze.js";

const setNow = TestClock.setTime(Date.parse("2026-06-01T12:00:00Z"));

const CHRONIC = "src/chronic.ts";
const ACUTE = "src/acute.ts";
const QUIET = Array.from({ length: 9 }, (_, index) => `src/quiet-${index}.ts`);

/**
 * Six quarters. `src/chronic.ts` is revised five times in each, the quiet
 * files once; `src/acute.ts` is revised five times in the last two only.
 */
const quarters = (
  lateOnly: ReadonlyArray<Change>,
): ReadonlyArray<ReadonlyArray<Change>> =>
  [false, false, false, false, true, true].map((late) =>
    [...repeated(5, CHRONIC), ...QUIET.map((file) => touching(file))].concat(
      late ? lateOnly : [],
    ),
  );

layer(NodeServices.layer)("analyze heat", (it) => {
  it.effect(
    "tells a file that is hot in most quarters from one that became hot lately",
    () =>
      Effect.gen(function* () {
        yield* setNow;
        const repo = yield* makeTempRepository;
        yield* createFiles(
          repo,
          Object.fromEntries(
            [CHRONIC, ACUTE, ...QUIET].map((file) => [file, lines(3, file)]),
          ),
        );
        yield* commitQuarters(repo, quarters(repeated(5, ACUTE)));

        const { files } = yield* analyze(
          analyzeOptionsFor(repo, { since: "18m" }),
        );

        assert.deepStrictEqual(
          Object.fromEntries(files.map(({ path, heat }) => [path, heat])),
          {
            [CHRONIC]: { kind: "chronic", hotWindows: 6, windows: 6 },
            [ACUTE]: { kind: "acute", hotWindows: 2, windows: 2 },
            ...Object.fromEntries(QUIET.map((file) => [file, null])),
          },
        );
      }),
  );
});

layer(NodeServices.layer)("analyze heat without a basis", (it) => {
  it.effect(
    "classifies nothing when no earlier quarter has the changes to compare with",
    () =>
      Effect.gen(function* () {
        yield* setNow;
        const repo = yield* makeTempRepository;
        yield* createFiles(
          repo,
          Object.fromEntries(
            [CHRONIC, ...QUIET].map((file) => [file, lines(3, file)]),
          ),
        );
        yield* commitQuarters(repo, [
          [],
          [],
          quarters([])[0] ?? [],
          quarters([])[0] ?? [],
        ]);

        const { files } = yield* analyze(analyzeOptionsFor(repo));

        // two active quarters: too few for a chronic file, and none before them for an acute one
        assert.deepStrictEqual(
          files.map(({ heat }) => heat),
          files.map(() => null),
        );
      }),
  );

  it.effect("classifies nothing without a series", () =>
    Effect.gen(function* () {
      yield* setNow;
      const repo = yield* makeTempRepository;
      yield* createFiles(repo, { [CHRONIC]: lines(3, CHRONIC) });

      const { files } = yield* analyze(
        analyzeOptionsFor(repo, { since: "1m" }),
      );

      assert.deepStrictEqual(
        files.map(({ heat }) => heat),
        [null],
      );
    }),
  );
});
