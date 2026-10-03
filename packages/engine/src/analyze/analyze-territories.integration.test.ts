import { NodeServices } from "@effect/platform-node";
import { assert, layer } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";
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

layer(NodeServices.layer)("analyze territories", (it) => {
  it.effect(
    "describes a territory by its manifest, its README, or its most changed files, and keeps the text safe to print",
    () =>
      Effect.gen(function* () {
        yield* setNow;
        const repo = yield* makeTempRepository;
        yield* repo.commit(day(1), {
          ...filesIn("billing", 1),
          "billing/package.json": '{ "description": "Invoices and tax." }\n',
          "billing/README.md": "# billing\n\nIgnored: the manifest wins.\n",
          ...filesIn("web", 1),
          "web/README.md":
            "# web\n\n[![ci](https://ci/badge.svg)](https://ci)\n\nThe **storefront** of the shop. It sells things.\n",
          ...filesIn("auth", 1),
          ...filesIn("shell", 1),
          "shell/README.md": "The \u001B[31mshell\u001B[0m\u202E front.\n",
        });
        yield* repo.commit(day(2), { "auth/b.ts": code(2) });
        yield* repo.commit(day(3), { "auth/b.ts": code(3) });

        const report = yield* analyze(analyzeOptionsFor(repo));

        const described = Object.fromEntries(
          report.territories.nodes.map((node) => [node.path, node.description]),
        );
        assert.deepStrictEqual(described, {
          ".": "main files: b, a, c",
          auth: "main files: b, a, c",
          billing: "Invoices and tax.",
          shell: "The [31mshell [0m front.",
          web: "The storefront of the shop.",
        });
        for (const { description } of report.territories.nodes) {
          assert.notMatch(description, /\p{Cc}|\p{Cf}/u);
        }
      }),
  );
});

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

layer(NodeServices.layer)("analyze territories and links", (it) => {
  it.effect(
    "does not read a README that the work tree replaced with a link",
    () =>
      Effect.gen(function* () {
        yield* setNow;
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const repo = yield* makeTempRepository;
        yield* repo.commit(day(1), {
          ...filesIn("billing", 1),
          "billing/README.md": "Billing prose that is long enough.\n",
          ...filesIn("web", 1),
          "web/README.md": "The storefront of the shop.\n",
        });
        const secret = path.join(repo.directory, "outside.txt");
        const readme = path.join(repo.directory, "billing/README.md");
        yield* fs.writeFileString(secret, "A sentence from another file.\n");
        yield* fs.remove(readme);
        yield* fs.symlink(secret, readme);

        const report = yield* analyze(analyzeOptionsFor(repo));

        const described = Object.fromEntries(
          report.territories.nodes.map((node) => [node.path, node.description]),
        );
        assert.strictEqual(described["billing"], "main files: a, b, c");
        assert.strictEqual(described["web"], "The storefront of the shop.");
      }),
  );
});
