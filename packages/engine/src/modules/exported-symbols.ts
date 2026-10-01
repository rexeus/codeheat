// Owns counting the symbols a module exports: those of its entry points,
// followed through `export * from` into the files of the same module.
import { Effect, FileSystem, Path } from "effect";

import { adapterFor } from "../code/language-adapter.js";
import type {
  LanguageAdapter,
  SourceExports,
} from "../code/language-adapter.js";
import type { Resolver } from "../imports/resolve.js";
import type { ModuleRef } from "./detect.js";

export type SymbolSources = {
  /** Absolute path of the work tree root. */
  readonly root: string;
  readonly adapters: ReadonlyArray<LanguageAdapter>;
  /** Resolves the specifiers of `export * from`; only relative ones can name a file. */
  readonly resolve: Resolver;
  /** The module of every universe file. */
  readonly modules: ReadonlyMap<string, ModuleRef>;
};

/** A file to list and whether `export *` brought it in, which leaves out its default export. */
type Visit = { readonly file: string; readonly forwarded: boolean };

/** The exports of `file`; undefined when no adapter reads it, it is unreadable, or the adapter cannot list them. */
const listExports = (
  { root, adapters }: SymbolSources,
  file: string,
): Effect.Effect<
  SourceExports | undefined,
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
    return adapter.exports(file, source);
  }).pipe(Effect.orElseSucceed(() => undefined));

/**
 * The files `specifiers` name, written in `from`, each one a file of `module`;
 * undefined when one is a package, resolves to nothing or to several files, or
 * leaves the module, since its implementation would then not be counted.
 */
const forwardedFiles = (
  { resolve, modules }: SymbolSources,
  module: string,
  from: string,
  specifiers: ReadonlyArray<string>,
): ReadonlyArray<string> | undefined => {
  const targets: Array<string> = [];
  for (const specifier of specifiers) {
    const { files, resolved } = resolve(from, specifier);
    const [target] = files;
    if (
      !resolved ||
      files.length !== 1 ||
      target === undefined ||
      modules.get(target)?.path !== module
    ) {
      return undefined;
    }
    targets.push(target);
  }
  return targets;
};

/**
 * The number of distinct symbols `entryPoints` export, all of them files of
 * `module`: their own names, and those of the files they forward with
 * `export * from` (relative specifiers, transitively, `default` left out), a
 * cycle visited once. Undefined when that cannot be told exactly: a file is
 * read by no adapter, unreadable or unlistable, or a forwarded specifier does
 * not name exactly one file of the module.
 */
export const countExportedSymbols = (
  sources: SymbolSources,
  module: string,
  entryPoints: ReadonlyArray<string>,
): Effect.Effect<
  number | undefined,
  never,
  FileSystem.FileSystem | Path.Path
> =>
  Effect.gen(function* () {
    const names = new Set<string>();
    const visited = new Set<string>();
    const pending: Array<Visit> = entryPoints.map((file) => ({
      file,
      forwarded: false,
    }));
    for (
      let visit = pending.pop();
      visit !== undefined;
      visit = pending.pop()
    ) {
      const key = `${visit.forwarded ? "*" : "="}${visit.file}`;
      if (visited.has(key)) {
        continue;
      }
      visited.add(key);
      const listed = yield* listExports(sources, visit.file);
      const next =
        listed === undefined
          ? undefined
          : forwardedFiles(sources, module, visit.file, listed.forwarded);
      if (listed === undefined || next === undefined) {
        return undefined;
      }
      for (const name of listed.names) {
        // `export *` never forwards a default export.
        if (!visit.forwarded || name !== "default") {
          names.add(name);
        }
      }
      pending.push(...next.map((file) => ({ file, forwarded: true })));
    }
    return names.size;
  });
