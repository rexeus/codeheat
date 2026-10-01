// Owns reading the files a package.json names as its public entry points.
// The manifest is untrusted input: anything unreadable or malformed names nothing,
// and one malformed field never discards the others.
import { Effect, FileSystem, Option, Schema } from "effect";

/** Nesting levels of `exports` (conditions within subpaths within lists) that are followed; real manifests need about four. */
const MAX_EXPORTS_DEPTH = 8;

const decodeObject = Schema.decodeUnknownOption(
  Schema.Record(Schema.String, Schema.Unknown),
);
const decodeList = Schema.decodeUnknownOption(Schema.Array(Schema.Unknown));
const decodeString = Schema.decodeUnknownOption(Schema.String);

/** The values of an object or the items of a list; nothing for any other value. */
const childrenOf = (value: unknown): ReadonlyArray<unknown> =>
  Option.getOrElse(decodeList(value), () =>
    Option.match(decodeObject(value), {
      onNone: () => [],
      onSome: (record) => Object.values(record),
    }),
  );

/** Every string in an `exports` value, whatever mix of lists and objects holds it, down to `MAX_EXPORTS_DEPTH` levels. */
const exportTargets = (exports: unknown): ReadonlyArray<string> => {
  const targets: Array<string> = [];
  const pending = [{ value: exports, depth: 0 }];
  for (let next = pending.pop(); next !== undefined; next = pending.pop()) {
    const { value, depth } = next;
    if (typeof value === "string") {
      targets.push(value);
    } else if (depth < MAX_EXPORTS_DEPTH) {
      for (const child of childrenOf(value)) {
        pending.push({ value: child, depth: depth + 1 });
      }
    }
  }
  return targets;
};

const targetsOf = (
  manifest: Record<string, unknown>,
): ReadonlyArray<string> => [
  ...["main", "module", "types"].flatMap((field) =>
    Option.toArray(decodeString(manifest[field])),
  ),
  ...exportTargets(manifest["exports"]),
];

/**
 * The file paths `manifestFile` names in `exports` (strings, lists, and nested
 * conditions or subpaths), `main`, `module`, and `types`, as written, relative
 * to the package directory. A missing, unreadable, or unparsable manifest names
 * none; a field of the wrong type is skipped on its own.
 */
export const readManifestTargets = (
  manifestFile: string,
): Effect.Effect<ReadonlyArray<string>, never, FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const text = yield* Effect.option(fs.readFileString(manifestFile));
    if (Option.isNone(text)) {
      return [];
    }
    const parsed = yield* Effect.option(
      Effect.try(() => JSON.parse(text.value) as unknown),
    );
    return parsed.pipe(
      Option.flatMap((manifest) => decodeObject(manifest)),
      Option.map((manifest) => targetsOf(manifest)),
      Option.getOrElse((): ReadonlyArray<string> => []),
    );
  });
