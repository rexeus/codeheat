// Owns reading what each file imports from the universe, loading only the
// files a question needs.
import { Effect, FileSystem, Path } from "effect";

import { adapterFor } from "../code/language-adapter.js";
import type { LanguageAdapter } from "../code/language-adapter.js";
import type { Resolver } from "./resolve.js";

/** Files read at once; bounds open file handles. */
const READ_CONCURRENCY = 16;

/** The universe files one file refers to. */
export type ModuleLinks = {
  /** Files it imports or re-exports from. */
  readonly targets: ReadonlySet<string>;
  /** The files among `targets` it re-exports from. */
  readonly reexports: ReadonlySet<string>;
};

export type LinkSources = {
  /** Absolute path of the work tree root. */
  readonly root: string;
  readonly adapters: ReadonlyArray<LanguageAdapter>;
  readonly resolve: Resolver;
};

/** The links of `file`; undefined when no adapter reads it, or it is unreadable or does not parse. */
const readLinks = (
  { root, adapters, resolve }: LinkSources,
  file: string,
): Effect.Effect<
  ModuleLinks | undefined,
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
    const found = adapter.imports(file, source);
    if (found === undefined) {
      return undefined;
    }
    const toFiles = (specifiers: ReadonlyArray<string>) =>
      specifiers.flatMap((specifier) => resolve(file, specifier));
    const reexports = new Set(toFiles(found.reexports));
    return {
      targets: new Set([...toFiles(found.imports), ...reexports]),
      reexports,
    };
  }).pipe(Effect.orElseSucceed(() => undefined));

/**
 * Reads the links of `roots` and of every file whose own links decide what a
 * root reaches: the files it imports, and the files those re-export from,
 * transitively. Files without links (see `readLinks`) are absent from the result.
 */
export const loadLinks = (
  sources: LinkSources,
  roots: ReadonlySet<string>,
): Effect.Effect<
  ReadonlyMap<string, ModuleLinks>,
  never,
  FileSystem.FileSystem | Path.Path
> =>
  Effect.gen(function* () {
    const links = new Map<string, ModuleLinks>();
    const attempted = new Set<string>();
    let pending: ReadonlyArray<string> = [...roots];
    while (pending.length > 0) {
      for (const file of pending) {
        attempted.add(file);
      }
      const loaded = yield* Effect.forEach(
        pending,
        (file) => readLinks(sources, file),
        { concurrency: READ_CONCURRENCY },
      );
      const next = new Set<string>();
      for (const [index, file] of pending.entries()) {
        const found = loaded[index];
        if (found === undefined) {
          continue;
        }
        links.set(file, found);
        for (const target of roots.has(file)
          ? found.targets
          : found.reexports) {
          next.add(target);
        }
      }
      pending = [...next].filter((file) => !attempted.has(file));
    }
    return links;
  });

/** Every file `start` imports, directly or through the re-exports of what it imports. */
export const reachableFrom = (
  links: ReadonlyMap<string, ModuleLinks>,
  start: string,
): ReadonlySet<string> => {
  const reached = new Set(links.get(start)?.targets);
  const pending = [...reached];
  for (let file = pending.pop(); file !== undefined; file = pending.pop()) {
    for (const target of links.get(file)?.reexports ?? []) {
      if (!reached.has(target)) {
        reached.add(target);
        pending.push(target);
      }
    }
  }
  return reached;
};
