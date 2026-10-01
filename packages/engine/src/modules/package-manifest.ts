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

/** The manifest as an object; undefined when it is missing, unreadable, or not a JSON object. */
const readManifest = (
  manifestFile: string,
): Effect.Effect<
  Record<string, unknown> | undefined,
  never,
  FileSystem.FileSystem
> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const text = yield* Effect.option(fs.readFileString(manifestFile));
    if (Option.isNone(text)) {
      return undefined;
    }
    const parsed = yield* Effect.option(
      Effect.try(() => JSON.parse(text.value) as unknown),
    );
    return parsed.pipe(
      Option.flatMap((manifest) => decodeObject(manifest)),
      Option.getOrUndefined,
    );
  });

/**
 * The file paths `manifestFile` names in `exports` (strings, lists, and nested
 * conditions or subpaths), `main`, `module`, and `types`, as written, relative
 * to the package directory. A missing, unreadable, or unparsable manifest names
 * none; a field of the wrong type is skipped on its own.
 */
export const readManifestTargets = (
  manifestFile: string,
): Effect.Effect<ReadonlyArray<string>, never, FileSystem.FileSystem> =>
  Effect.map(readManifest(manifestFile), (manifest) =>
    manifest === undefined ? [] : targetsOf(manifest),
  );

const DEPENDENCY_FIELDS = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
];

/** The names a manifest declares in its dependency fields; fields of the wrong type declare none. */
const dependenciesOf = (
  manifest: Record<string, unknown>,
): ReadonlyArray<string> =>
  DEPENDENCY_FIELDS.flatMap((field) =>
    Option.match(decodeObject(manifest[field]), {
      onNone: () => [],
      onSome: (declared) => Object.keys(declared),
    }),
  );

/**
 * The targets by which the package is imported by its bare name: what
 * `exports` maps `"."` to (or `exports` itself when it holds no subpaths),
 * else `main`, `module`, and `types`.
 */
const rootTargetsOf = (
  manifest: Record<string, unknown>,
): ReadonlyArray<string> => {
  const exports = manifest["exports"];
  const subpaths = decodeObject(exports);
  const isSubpathMap =
    Option.isSome(subpaths) &&
    Object.keys(subpaths.value).some((key) => key.startsWith("."));
  const exported = exportTargets(isSubpathMap ? subpaths.value["."] : exports);
  return exported.length > 0
    ? exported
    : ["main", "module", "types"].flatMap((field) =>
        Option.toArray(decodeString(manifest[field])),
      );
};

/** What a `package.json` says about the package and what it depends on. */
export type ManifestFacts = {
  /** The package name; undefined when absent or not a string. */
  readonly name: string | undefined;
  /** The files that importing the package by its name reaches, as written, relative to the package directory. */
  readonly rootTargets: ReadonlyArray<string>;
  /** Names declared in `dependencies`, `devDependencies`, `peerDependencies`, and `optionalDependencies`. */
  readonly dependencies: ReadonlyArray<string>;
};

/** The facts of the manifest; undefined when it is missing, unreadable, or not a JSON object. */
export const readManifestFacts = (
  manifestFile: string,
): Effect.Effect<ManifestFacts | undefined, never, FileSystem.FileSystem> =>
  Effect.map(readManifest(manifestFile), (manifest) =>
    manifest === undefined
      ? undefined
      : {
          name: Option.getOrUndefined(decodeString(manifest["name"])),
          rootTargets: rootTargetsOf(manifest),
          dependencies: dependenciesOf(manifest),
        },
  );
