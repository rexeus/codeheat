import { NodeServices } from "@effect/platform-node";
import { assert, layer } from "@effect/vitest";
import { Effect } from "effect";
import { TestClock } from "effect/testing";
import { parseSync } from "oxc-parser";

import { typescriptAdapter } from "../code/typescript-adapter.js";
import { analyzeOptionsFor } from "../testing/analyze-options.js";
import { makeTempRepository } from "../testing/temp-repository.js";
import { analyze } from "./analyze.js";

const setNow = TestClock.setTime(Date.parse("2026-06-01T12:00:00Z"));

const day = (number: number): string =>
  `2026-05-${String(number).padStart(2, "0")}T12:00:00Z`;

const manifest = JSON.stringify({ name: "package" });

layer(NodeServices.layer)("analyze distant couplings", (it) => {
  it.effect(
    "ranks pairs across modules, a hidden one before a visible one, and leaves out tests and pairs within a directory",
    () =>
      Effect.gen(function* () {
        yield* setNow;
        const repo = yield* makeTempRepository;
        yield* repo.commit(day(1), {
          "packages/core/package.json": manifest,
          "packages/compiler/package.json": manifest,
          "packages/app/package.json": manifest,
        });
        for (let revision = 1; revision <= 5; revision += 1) {
          yield* repo.commit(day(revision + 1), {
            "packages/core/src/a.ts": `export const a = ${revision};`,
            "packages/core/test/a.test.ts": `// revision ${revision}`,
            "packages/compiler/src/b.ts": `export const b = ${revision};`,
            "packages/app/src/c.ts": `import { a } from "../../core/src/a";\nexport const c = a + ${revision};`,
          });
        }

        const report = yield* analyze(
          analyzeOptionsFor(repo, { adapters: [typescriptAdapter(parseSync)] }),
        );

        assert.deepStrictEqual(
          report.distantCouplings.map(
            ({ a, b, imports, score }) => `${a} ${b} ${imports} ${score}`,
          ),
          [
            "packages/app/src/c.ts packages/compiler/src/b.ts none 4.5",
            "packages/compiler/src/b.ts packages/core/src/a.ts none 4.5",
            "packages/app/src/c.ts packages/core/src/a.ts a→b 3",
          ],
        );
        assert.deepStrictEqual(report.distantCouplings[0]?.modules, {
          a: "packages/app",
          b: "packages/compiler",
        });
        assert.deepStrictEqual(
          report.moduleCoupling.map(
            ({ a, b, sharedCommits, share }) =>
              `${a} ${b} ${sharedCommits} ${share}`,
          ),
          [
            "packages/app packages/compiler 5 1",
            "packages/app packages/core 5 1",
            "packages/compiler packages/core 5 1",
          ],
        );
        assert.strictEqual(report.thresholds.minLocalDistance, 3);
      }),
  );
});
