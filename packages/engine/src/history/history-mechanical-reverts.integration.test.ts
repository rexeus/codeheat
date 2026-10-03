import { NodeServices } from "@effect/platform-node";
import { assert, layer } from "@effect/vitest";
import { Effect } from "effect";

import { Git } from "../git/git.js";
import { makeTempRepository } from "../testing/temp-repository.js";
import { readHistory } from "./history.js";

const body = (extra = "") =>
  Array.from({ length: 10 }, (_, index) => `const value${index} = ${index};\n`)
    .join("")
    .concat(extra);

const universe = ["a.ts", "b.ts", "c.ts", "d.ts", "e.ts"];

const read = (directory: string) =>
  readHistory({
    since: "2026-01-01T00:00:00.000Z",
    until: "2026-12-31T00:00:00.000Z",
    skipCommits: new Set(),
    universe: new Set(universe),
  }).pipe(Effect.provide(Git.layer(directory)));

layer(NodeServices.layer)(
  "readHistory reverts that are not clean undos",
  (it) => {
    it.effect(
      "counts a squash commit that names a reverted commit and does other work",
      () =>
        Effect.gen(function* () {
          const repo = yield* makeTempRepository;
          yield* repo.commit("2026-03-01T12:00:00Z", {
            "a.ts": body(),
            "b.ts": body(),
            "d.ts": body(),
          });
          yield* repo.commit("2026-03-02T12:00:00Z", {
            "a.ts": body("// risky\n"),
          });
          const risky = (yield* repo.git("rev-parse", "HEAD")).trim();
          yield* repo.commit(
            "2026-03-03T12:00:00Z",
            {
              "a.ts": body(),
              "b.ts": body("// more\n"),
              "d.ts": body("// more\n"),
              "e.ts": body(),
            },
            `Squash\n\nThis reverts commit ${risky}.\n`,
          );

          const result = yield* read(repo.directory);

          assert.strictEqual(result.mechanical.reverts, 0);
          assert.strictEqual(result.files.get("e.ts")?.revisions, 1);
          assert.strictEqual(result.files.get("a.ts")?.revisions, 3);
        }),
    );

    it.effect(
      "counts a revert that undoes only part of the commit it names",
      () =>
        Effect.gen(function* () {
          const repo = yield* makeTempRepository;
          yield* repo.commit("2026-03-01T12:00:00Z", {
            "a.ts": body(),
            "b.ts": body(),
          });
          yield* repo.commit("2026-03-02T12:00:00Z", {
            "a.ts": body("// risky\n"),
            "b.ts": body("// risky\n"),
            "c.ts": body(),
          });
          const risky = (yield* repo.git("rev-parse", "HEAD")).trim();
          yield* repo.commit(
            "2026-03-03T12:00:00Z",
            { "a.ts": body() },
            `Revert "risky" in a.ts\n\nThis reverts commit ${risky}.\n`,
          );

          const result = yield* read(repo.directory);

          assert.strictEqual(result.mechanical.reverts, 0);
          assert.strictEqual(result.files.get("a.ts")?.revisions, 3);
          assert.strictEqual(result.files.get("b.ts")?.revisions, 2);
        }),
    );
  },
);

layer(NodeServices.layer)(
  "readHistory reverts that do not mirror their original",
  (it) => {
    it.effect(
      "counts a squash that reverts a commit and rewrites the same file",
      () =>
        Effect.gen(function* () {
          const repo = yield* makeTempRepository;
          yield* repo.commit("2026-03-01T12:00:00Z", { "a.ts": body() });
          yield* repo.commit("2026-03-02T12:00:00Z", {
            "a.ts": body("// cached\n"),
          });
          const cached = (yield* repo.git("rev-parse", "HEAD")).trim();
          yield* repo.commit(
            "2026-03-03T12:00:00Z",
            {
              "a.ts": body().replace(
                "const value3 = 3;\n",
                "const value3 = 3;\nconst value3b = 4;\n",
              ),
            },
            `Replace the cache\n\nThis reverts commit ${cached}.\n`,
          );

          const result = yield* read(repo.directory);

          assert.strictEqual(result.mechanical.reverts, 0);
          assert.strictEqual(result.files.get("a.ts")?.revisions, 3);
        }),
    );

    it.effect(
      "counts a revert that keeps one file's change of the commit it names",
      () =>
        Effect.gen(function* () {
          const repo = yield* makeTempRepository;
          yield* repo.commit("2026-03-01T12:00:00Z", {
            "a.ts": body(),
            "b.ts": body(),
          });
          yield* repo.commit("2026-03-02T12:00:00Z", {
            "a.ts": body("// risky\n"),
            "b.ts": body("// risky\n"),
          });
          const risky = (yield* repo.git("rev-parse", "HEAD")).trim();
          yield* repo.git("revert", "--no-commit", risky);
          yield* repo.commit(
            "2026-03-03T12:00:00Z",
            { "b.ts": body("// risky\n// kept\n") },
            `Revert "risky"\n\nThis reverts commit ${risky}.\n`,
          );

          const result = yield* read(repo.directory);

          assert.strictEqual(result.mechanical.reverts, 0);
          assert.strictEqual(result.files.get("a.ts")?.revisions, 3);
          assert.strictEqual(result.files.get("b.ts")?.revisions, 3);
        }),
    );
  },
);

layer(NodeServices.layer)(
  "readHistory reverts with files outside the universe",
  (it) => {
    it.effect(
      "pairs a revert that mirrors every code file but regenerates a lockfile",
      () =>
        Effect.gen(function* () {
          const repo = yield* makeTempRepository;
          yield* repo.commit("2026-03-01T12:00:00Z", {
            "a.ts": body(),
            "b.ts": body(),
            "package-lock.json": "1\n",
          });
          yield* repo.commit("2026-03-02T12:00:00Z", {
            "a.ts": body("// risky\n"),
            "b.ts": body("// risky\n"),
            "package-lock.json": "1\n2\n3\n",
          });
          const risky = (yield* repo.git("rev-parse", "HEAD")).trim();
          yield* repo.git("revert", "--no-commit", risky);
          yield* repo.commit(
            "2026-03-03T12:00:00Z",
            { "package-lock.json": "1\n9\n" },
            `Revert "risky"\n\nThis reverts commit ${risky}.\n`,
          );

          const result = yield* read(repo.directory);

          assert.strictEqual(result.mechanical.reverts, 2);
          assert.strictEqual(result.files.get("a.ts")?.revisions, 1);
          assert.strictEqual(result.files.get("b.ts")?.revisions, 1);
        }),
    );

    it.effect(
      "does not pair a revert with a commit that changed a lockfile only",
      () =>
        Effect.gen(function* () {
          const repo = yield* makeTempRepository;
          yield* repo.commit("2026-03-01T12:00:00Z", {
            "a.ts": body(),
            "package-lock.json": "1\n",
          });
          yield* repo.commit("2026-03-02T12:00:00Z", {
            "package-lock.json": "1\n2\n",
          });
          const bump = (yield* repo.git("rev-parse", "HEAD")).trim();
          yield* repo.commit(
            "2026-03-03T12:00:00Z",
            { "a.ts": body("// work\n"), "package-lock.json": "1\n" },
            `Revert the bump\n\nThis reverts commit ${bump}.\n`,
          );

          const result = yield* read(repo.directory);

          assert.strictEqual(result.mechanical.reverts, 0);
          assert.strictEqual(result.files.get("a.ts")?.revisions, 2);
        }),
    );
  },
);

layer(NodeServices.layer)(
  "readHistory reverts with mirrored counts but other content",
  (it) => {
    it.effect(
      "counts a squash that replaces the reverted change with another of the same size",
      () =>
        Effect.gen(function* () {
          const repo = yield* makeTempRepository;
          yield* repo.commit("2026-03-01T12:00:00Z", {
            "a.ts": "export const a = 1;\nexport const b = 2;\n",
          });
          yield* repo.commit("2026-03-02T12:00:00Z", {
            "a.ts":
              "export const a = 1;\nexport const b = 3;\nexport const z = 9;\n",
          });
          const change = (yield* repo.git("rev-parse", "HEAD")).trim();
          yield* repo.commit(
            "2026-03-03T12:00:00Z",
            { "a.ts": "export const a = 1;\nexport const b = 4;\n" },
            `* Revert "feat: change a"\n\nThis reverts commit ${change}.\n\n* feat: lru\n`,
          );

          const result = yield* read(repo.directory);

          assert.strictEqual(result.mechanical.reverts, 0);
          assert.strictEqual(result.files.get("a.ts")?.revisions, 3);
        }),
    );

    it.effect(
      "pairs a clean revert of a change to a file without a final newline",
      () =>
        Effect.gen(function* () {
          const repo = yield* makeTempRepository;
          yield* repo.commit("2026-03-01T12:00:00Z", { "a.ts": "one\ntwo" });
          yield* repo.commit("2026-03-02T12:00:00Z", {
            "a.ts": "one\ntwo\nthree",
          });
          yield* repo.gitAt(
            "2026-03-03T12:00:00Z",
            "revert",
            "--no-edit",
            "HEAD",
          );

          const result = yield* read(repo.directory);

          assert.strictEqual(result.mechanical.reverts, 2);
        }),
    );
  },
);
