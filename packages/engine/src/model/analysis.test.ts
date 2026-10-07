import { NodeServices } from "@effect/platform-node";
import { assert, layer } from "@effect/vitest";
import { Effect, FileSystem, Path, Schema } from "effect";

import { Analysis } from "./analysis.js";

const readSample = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const location = yield* path.fromFileUrl(
    new URL("../../../../fixtures/report.sample.json", import.meta.url),
  );
  const json: unknown = JSON.parse(yield* fs.readFileString(location));
  return json;
});

const decode = Schema.decodeUnknownSync(Analysis);

layer(NodeServices.layer)("Analysis", (it) => {
  it.effect(
    "decodes the committed sample report in fixtures/report.sample.json",
    () =>
      Effect.gen(function* () {
        const report = decode(yield* readSample);

        assert.strictEqual(report.schemaVersion, 1);
        assert.isAbove(report.files.length, 30);
        assert.isAbove(report.couplings.length, 0);
      }),
  );

  it.effect("rejects a score outside 0..1", () =>
    Effect.gen(function* () {
      const sample = decode(yield* readSample);
      const tooHot = { ...sample, files: [{ ...sample.files[0], score: 1.5 }] };

      assert.throws(() => {
        decode(tooHot);
      }, /score/u);
    }),
  );

  it.effect("rejects a schemaVersion other than 1", () =>
    Effect.gen(function* () {
      const sample = decode(yield* readSample);

      assert.throws(() => {
        decode({ ...sample, schemaVersion: 2 });
      }, /schemaVersion/u);
    }),
  );
});
