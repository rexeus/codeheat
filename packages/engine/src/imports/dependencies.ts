// Owns the coarse dependency graph: which universe file loads which other,
// read as cheaply as the language allows, for questions about many files at
// once (who depends on this file, which module depends on which).
import { Effect, FileSystem, Path } from "effect";

import { adapterFor } from "../code/language-adapter.js";
import type { LinkSources } from "./module-links.js";

/** Files read at once; bounds open file handles. */
const READ_CONCURRENCY = 16;

/** The universe files each file loads directly: its imports and re-exports, not what they re-export in turn. */
export type Dependencies = ReadonlyMap<string, ReadonlySet<string>>;

const readDependencies = (
  { root, adapters, resolve }: LinkSources,
  file: string,
): Effect.Effect<
  ReadonlySet<string> | undefined,
  never,
  FileSystem.FileSystem | Path.Path
> =>
  Effect.gen(function* () {
    const adapter = adapterFor(adapters, file);
    if (adapter === undefined) {
      return undefined;
    }
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const source = yield* fs.readFileString(path.join(root, file));
    const specifiers = adapter.dependencies(file, source);
    return specifiers === undefined
      ? undefined
      : new Set(
          specifiers.flatMap((specifier) => resolve(file, specifier).files),
        );
  }).pipe(Effect.orElseSucceed(() => undefined));

/**
 * Reads what each of `files` loads, except those `known` already says. A file
 * that no adapter reads or that cannot be read is absent from the result: its
 * dependencies are unknown, not none. `known` is part of the result, files
 * outside `files` included.
 */
export const loadDependencies = (
  sources: LinkSources,
  files: ReadonlyArray<string>,
  known: Dependencies,
): Effect.Effect<Dependencies, never, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function* () {
    const unread = files.filter((file) => !known.has(file));
    const read = yield* Effect.forEach(
      unread,
      (file) => readDependencies(sources, file),
      { concurrency: READ_CONCURRENCY },
    );
    return new Map([
      ...known,
      ...unread.flatMap((file, index) => {
        const found = read[index];
        return found === undefined ? [] : [[file, found] as const];
      }),
    ]);
  });

/**
 * For each file, the files that load it directly. A file is no dependent of
 * itself. Files nothing loads are absent.
 */
export const dependentsByFile = (
  dependencies: Dependencies,
): ReadonlyMap<string, ReadonlySet<string>> => {
  const dependents = new Map<string, Set<string>>();
  for (const [file, loaded] of dependencies) {
    for (const target of loaded) {
      if (target !== file) {
        dependents.set(target, (dependents.get(target) ?? new Set()).add(file));
      }
    }
  }
  return dependents;
};
