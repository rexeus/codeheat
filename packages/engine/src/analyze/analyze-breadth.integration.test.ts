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

layer(NodeServices.layer)("analyze breadth", (it) => {
  it.effect(
    "reports a barrel changed with twelve different files as a hub, however rarely each one joins",
    () =>
      Effect.gen(function* () {
        yield* setNow;
        const repo = yield* makeTempRepository;
        // commit n touches the barrel and its own file f<n>: 12 partners, 1 shared commit each
        for (let index = 0; index < 12; index += 1) {
          yield* repo.commit(day(index + 1), {
            "index.ts": `${index}\n`,
            [`f${index}.ts`]: "x\n",
          });
        }

        const report = yield* analyze(analyzeOptionsFor(repo));

        const barrel = report.files.find(({ path }) => path === "index.ts");
        assert.strictEqual(barrel?.breadth, 12);
        // index.ts is also the module's entry point, which every commit touches
        assert.deepStrictEqual(barrel?.reasons.slice(-2), [
          "changes together with 12 different files",
          "interface changed in 100% of its module's implementation commits",
        ]);
        assert.deepStrictEqual(report.couplings, []);
        const partner = report.files.find(({ path }) => path === "f0.ts");
        assert.strictEqual(partner?.breadth, 1);
        assert.deepStrictEqual(partner?.reasons, [
          "changed in 1 commit (#2 of 13)",
        ]);
      }),
  );

  it.effect("does not count the files of a commit above maxCommitFiles", () =>
    Effect.gen(function* () {
      yield* setNow;
      const repo = yield* makeTempRepository;
      yield* repo.commit(day(1), { "a.ts": "1\n", "b.ts": "1\n" });
      // 51 files, one above the limit of 50
      yield* repo.commit(
        day(2),
        Object.fromEntries(
          Array.from({ length: 51 }, (_, index) => [`g${index}.ts`, "1\n"]),
        ),
      );
      yield* repo.commit(day(3), { "a.ts": "2\n" });

      const report = yield* analyze(analyzeOptionsFor(repo));

      const breadths = new Map(
        report.files.map((file) => [file.path, file.breadth]),
      );
      assert.deepStrictEqual(
        [breadths.get("a.ts"), breadths.get("b.ts"), breadths.get("g0.ts")],
        [1, 1, 0],
      );
    }),
  );
});
