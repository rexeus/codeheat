import { NodeServices } from "@effect/platform-node";
import { assert, layer } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";

import type { ModuleRef } from "./detect.js";
import { findEntryPoints } from "./entry-points.js";

const PACKAGE = "packages/a";

/**
 * Entry points of one module at `packages/a`, given its universe `files`
 * (repository-relative) and the text of its package.json, when it has one.
 */
const entryPointsOf = (
  files: ReadonlyArray<string>,
  manifest?: string,
  options: {
    readonly kind?: ModuleRef["kind"];
    readonly globs?: ReadonlyArray<string>;
  } = {},
) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const root = yield* fs.makeTempDirectoryScoped({ prefix: "codeheat-" });
    if (manifest !== undefined) {
      yield* fs.makeDirectory(path.join(root, PACKAGE), { recursive: true });
      yield* fs.writeFileString(
        path.join(root, PACKAGE, "package.json"),
        manifest,
      );
    }
    const ref: ModuleRef = { path: PACKAGE, kind: options.kind ?? "package" };
    const found = yield* findEntryPoints(
      root,
      new Map(files.map((file) => [file, ref])),
      options.globs ?? [],
    );
    return found.get(PACKAGE);
  });

const file = (relative: string): string => `${PACKAGE}/${relative}`;

layer(NodeServices.layer)("findEntryPoints from package.json", (it) => {
  it.effect("takes a string exports target", () =>
    Effect.gen(function* () {
      const entries = yield* entryPointsOf(
        [file("src/main.ts"), file("src/helper.ts")],
        '{ "exports": "./src/main.ts" }',
      );

      assert.deepStrictEqual(entries, [file("src/main.ts")]);
    }),
  );

  it.effect("takes every file of nested conditions, subpaths, and lists", () =>
    Effect.gen(function* () {
      const entries = yield* entryPointsOf(
        [
          file("src/esm.ts"),
          file("src/cjs.ts"),
          file("src/util.ts"),
          file("src/internal.ts"),
          file("src/helper.ts"),
        ],
        JSON.stringify({
          exports: {
            ".": {
              import: { default: "./src/esm.ts" },
              require: "./src/cjs.ts",
            },
            "./util": ["./src/util.ts", "./src/missing.ts"],
            "./internal/*": null,
            "./package.json": "./package.json",
          },
        }),
      );

      assert.deepStrictEqual(entries, [
        file("src/cjs.ts"),
        file("src/esm.ts"),
        file("src/util.ts"),
      ]);
    }),
  );

  it.effect("maps main, module, and types in dist back to their source", () =>
    Effect.gen(function* () {
      const entries = yield* entryPointsOf(
        [
          file("src/lib/core.ts"),
          file("src/lib/extra.ts"),
          file("src/other.ts"),
        ],
        JSON.stringify({
          main: "./dist/lib/core.js",
          module: "build/lib/core.mjs",
          types: "dist/lib/core.d.ts",
          exports: { "./gone": "./dist/gone.js" },
        }),
      );

      assert.deepStrictEqual(entries, [file("src/lib/core.ts")]);
    }),
  );
});

layer(NodeServices.layer)("findEntryPoints from built targets", (it) => {
  it.effect("prefers a built file that is itself in the universe", () =>
    Effect.gen(function* () {
      const entries = yield* entryPointsOf(
        [file("dist/index.js"), file("src/index.ts")],
        '{ "main": "./dist/index.js" }',
      );

      assert.deepStrictEqual(entries, [
        file("dist/index.js"),
        file("src/index.ts"),
      ]);
    }),
  );

  it.effect("falls back to conventions when the manifest is unusable", () =>
    Effect.gen(function* () {
      const files = [file("src/index.ts"), file("src/other.ts")];
      for (const manifest of [
        "{ not json",
        '{ "main": 5 }',
        '{ "exports": { "a": 1 } }',
        undefined,
      ]) {
        const entries = yield* entryPointsOf(files, manifest);

        assert.deepStrictEqual(entries, [file("src/index.ts")]);
      }
    }),
  );
});

layer(NodeServices.layer)("findEntryPoints by convention", (it) => {
  it.effect(
    "finds index, mod, lib, and __init__ files at the root or in src",
    () =>
      Effect.gen(function* () {
        const entries = yield* entryPointsOf([
          file("index.js"),
          file("src/index.tsx"),
          file("src/lib.rs"),
          file("src/mod.rs"),
          file("src/__init__.py"),
          file("src/index.test.ts"),
          file("src/index.d.ts"),
          file("src/deep/index.ts"),
          file("other/lib.rs"),
          file("main.ts"),
        ]);

        assert.deepStrictEqual(entries, [
          file("index.js"),
          file("src/__init__.py"),
          file("src/index.tsx"),
          file("src/lib.rs"),
          file("src/mod.rs"),
        ]);
      }),
  );

  it.effect("ignores package.json for a directory module", () =>
    Effect.gen(function* () {
      const entries = yield* entryPointsOf(
        [file("index.ts"), file("src/main.ts")],
        '{ "exports": "./src/main.ts" }',
        { kind: "directory" },
      );

      assert.deepStrictEqual(entries, [file("index.ts")]);
    }),
  );
});

layer(NodeServices.layer)("findEntryPoints with globs", (it) => {
  it.effect("replaces detection with the files the globs match", () =>
    Effect.gen(function* () {
      const entries = yield* entryPointsOf(
        [file("src/index.ts"), file("src/api.ts"), file("src/api/more.ts")],
        '{ "exports": "./src/index.ts" }',
        { globs: ["packages/*/src/api.ts", "**/more.ts"] },
      );

      assert.deepStrictEqual(entries, [
        file("src/api.ts"),
        file("src/api/more.ts"),
      ]);
    }),
  );
});
