// Owns reading what each file imports from the universe, loading only the
// files a question needs, and saying how far the answer can be trusted.
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
  /**
   * Every module the file loads is accounted for: it resolves to a universe
   * file, a built-in, a declared dependency, or an asset, and none is loaded by
   * an expression. When false, the file may depend on code that `targets` lacks.
   */
  readonly complete: boolean;
};

export type LinkSources = {
  /** Absolute path of the work tree root. */
  readonly root: string;
  readonly adapters: ReadonlyArray<LanguageAdapter>;
  readonly resolve: Resolver;
};

/** A file that cannot forward anything: it refers to no file and nothing in it matters to an importer. */
const INERT: ModuleLinks = {
  targets: new Set(),
  reexports: new Set(),
  complete: true,
};

/**
 * The links of `file`; undefined when no adapter reads it, or it is unreadable
 * or does not parse. A file that `isRoot` is read in full; any other file is
 * read only because another imports it, and is left unparsed (`INERT`) when
 * its adapter says it cannot re-export.
 */
const readLinks = (
  { root, adapters, resolve }: LinkSources,
  file: string,
  isRoot: boolean,
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
    if (!isRoot && !adapter.canReexport(source)) {
      return INERT;
    }
    const found = adapter.imports(file, source);
    if (found === undefined) {
      return undefined;
    }
    const resolveAll = (specifiers: ReadonlyArray<string>) =>
      specifiers.map((specifier) => resolve(file, specifier));
    const reexported = resolveAll(found.reexports);
    const resolutions = [...resolveAll(found.imports), ...reexported];
    return {
      targets: new Set(resolutions.flatMap(({ files }) => files)),
      reexports: new Set(reexported.flatMap(({ files }) => files)),
      complete:
        !found.computed && resolutions.every(({ resolved }) => resolved),
    };
  }).pipe(Effect.orElseSucceed(() => undefined));

/** Records what `loaded` says of the `pending` files; returns the files whose links are worth reading next. */
const absorb = (
  links: Map<string, ModuleLinks>,
  pending: ReadonlyArray<string>,
  loaded: ReadonlyArray<ModuleLinks | undefined>,
  roots: ReadonlySet<string>,
): ReadonlyArray<string> =>
  pending.flatMap((file, index) => {
    const found = loaded[index];
    if (found === undefined) {
      return [];
    }
    links.set(file, found);
    return [...(roots.has(file) ? found.targets : found.reexports)];
  });

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
      const loaded = yield* Effect.forEach(
        pending,
        (file) => readLinks(sources, file, roots.has(file)),
        { concurrency: READ_CONCURRENCY },
      );
      for (const file of pending) {
        attempted.add(file);
      }
      const next = new Set(absorb(links, pending, loaded, roots));
      pending = [...next].filter((file) => !attempted.has(file));
    }
    return links;
  });

/** What `start` reaches by importing, and whether that is all it reaches. */
export type Reach = {
  /** Every file `start` imports, directly or through the re-exports of what it imports. */
  readonly files: ReadonlySet<string>;
  /** Every file in `files` has links that are complete, so nothing it forwards is missing. */
  readonly known: boolean;
};

export const reachableFrom = (
  links: ReadonlyMap<string, ModuleLinks>,
  start: string,
): Reach => {
  const reached = new Set(links.get(start)?.targets);
  const pending = [...reached];
  let known = true;
  for (let file = pending.pop(); file !== undefined; file = pending.pop()) {
    const found = links.get(file);
    known = known && found?.complete === true;
    for (const target of found?.reexports ?? []) {
      if (!reached.has(target)) {
        reached.add(target);
        pending.push(target);
      }
    }
  }
  return { files: reached, known };
};
