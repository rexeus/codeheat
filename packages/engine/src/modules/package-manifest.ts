// Owns reading the files a package.json names as its public entry points.
// The manifest is untrusted input: anything unreadable or malformed names nothing.
import { Effect, FileSystem, Option, Schema } from "effect";

/** An `exports` value: a file, a list of alternatives, or conditions and subpaths mapping to more of the same. */
type ExportTarget =
  | string
  | null
  | ReadonlyArray<ExportTarget>
  | { readonly [key: string]: ExportTarget };

const ExportTarget: Schema.Codec<ExportTarget> = Schema.Union([
  Schema.String,
  Schema.Null,
  Schema.Array(Schema.suspend((): Schema.Codec<ExportTarget> => ExportTarget)),
  Schema.Record(
    Schema.String,
    Schema.suspend((): Schema.Codec<ExportTarget> => ExportTarget),
  ),
]);

const Manifest = Schema.Struct({
  main: Schema.optionalKey(Schema.String),
  module: Schema.optionalKey(Schema.String),
  types: Schema.optionalKey(Schema.String),
  exports: Schema.optionalKey(ExportTarget),
});

const decodeManifest = Schema.decodeUnknownOption(
  Schema.fromJsonString(Manifest),
);

const leaves = (target: ExportTarget): ReadonlyArray<string> => {
  if (target === null) {
    return [];
  }
  if (typeof target === "string") {
    return [target];
  }
  return Object.values(target).flatMap((child) => leaves(child));
};

/**
 * The file paths `manifestFile` names in `exports` (strings, lists, and nested
 * conditions or subpaths), `main`, `module`, and `types`, as written, relative
 * to the package directory. A missing, unreadable, or invalid manifest names none.
 */
export const readManifestTargets = (
  manifestFile: string,
): Effect.Effect<ReadonlyArray<string>, never, FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const text = yield* Effect.option(fs.readFileString(manifestFile));
    return Option.flatMap(text, decodeManifest).pipe(
      Option.map((manifest) => [
        ...[manifest.main, manifest.module, manifest.types].filter(
          (target) => target !== undefined,
        ),
        ...leaves(manifest.exports ?? null),
      ]),
      Option.getOrElse((): ReadonlyArray<string> => []),
    );
  });
