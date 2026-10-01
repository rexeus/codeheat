// Owns counting the names a module exports: those of its entry points,
// followed through `export * from` into the files of the same module.
import { Effect, FileSystem, Path } from "effect";

import { adapterFor } from "../code/language-adapter.js";
import type {
  LanguageAdapter,
  SourceExports,
} from "../code/language-adapter.js";
import type { Resolver } from "../imports/resolve.js";
import type { ModuleRef } from "./detect.js";
import { resolveExport } from "./export-resolution.js";
import type { ExportWorld } from "./export-resolution.js";

export type SymbolSources = {
  /** Absolute path of the work tree root. */
  readonly root: string;
  readonly adapters: ReadonlyArray<LanguageAdapter>;
  /** Resolves the specifiers of `export * from`; only relative ones can name a file. */
  readonly resolve: Resolver;
  /** The module of every universe file. */
  readonly modules: ReadonlyMap<string, ModuleRef>;
};

/** A file to load; a required one must be listable, for the others the answer only gets less exact. */
type Visit = { readonly file: string; readonly required: boolean };

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

/** The universe file that `specifier`, written in `from`, names, when it is exactly one. */
const fileNamedBy = (
  { resolve }: SymbolSources,
  from: string,
  specifier: string,
): string | undefined => {
  const { files, resolved } = resolve(from, specifier);
  const [target] = files;
  return resolved && files.length === 1 ? target : undefined;
};

/** The files of `module` that the exports of `file` refer to: the `export * from` sources, which are required, and the modules that named exports are taken from. */
const referencedFiles = (
  sources: SymbolSources,
  module: string,
  file: string,
  listed: SourceExports,
): ReadonlyArray<Visit> | undefined => {
  const named = listed.names.flatMap(({ binding }) =>
    "specifier" in binding && binding.specifier.startsWith(".")
      ? [binding.specifier]
      : [],
  );
  const visits: Array<Visit> = [];
  for (const specifier of listed.forwarded) {
    const target = fileNamedBy(sources, file, specifier);
    if (target === undefined || sources.modules.get(target)?.path !== module) {
      return undefined;
    }
    visits.push({ file: target, required: true });
  }
  for (const specifier of named) {
    const target = fileNamedBy(sources, file, specifier);
    if (target !== undefined && sources.modules.get(target)?.path === module) {
      visits.push({ file: target, required: false });
    }
  }
  return visits;
};

/**
 * Lists the file of a visit and the files it refers to. A file that cannot be
 * listed or forwards what cannot be followed aborts the whole count when the
 * visit is required; otherwise it is left out, its names staying unknown to
 * the importer, which is no reason to give up.
 */
const readVisit = (
  sources: SymbolSources,
  module: string,
  { file, required }: Visit,
): Effect.Effect<
  | { readonly listed: SourceExports; readonly next: ReadonlyArray<Visit> }
  | "abort"
  | "left out",
  never,
  FileSystem.FileSystem | Path.Path
> =>
  Effect.gen(function* () {
    const listed = yield* listExports(sources, file);
    const next =
      listed === undefined
        ? undefined
        : referencedFiles(sources, module, file, listed);
    if (listed === undefined || next === undefined) {
      return required ? "abort" : "left out";
    }
    return { listed, next };
  });

/**
 * The exports of `entryPoints` and of every file of `module` they reach by
 * re-exporting; undefined when a file that `export *` forwards cannot be
 * listed, or a forwarded specifier does not name exactly one file of the
 * module. A file that only a named re-export reaches is left out when it
 * cannot be listed or forwards what cannot be followed.
 */
const loadExports = (
  sources: SymbolSources,
  module: string,
  entryPoints: ReadonlyArray<string>,
): Effect.Effect<
  ReadonlyMap<string, SourceExports> | undefined,
  never,
  FileSystem.FileSystem | Path.Path
> =>
  Effect.gen(function* () {
    const loaded = new Map<string, SourceExports>();
    const failed = new Set<string>();
    const pending: Array<Visit> = entryPoints.map((file) => ({
      file,
      required: true,
    }));
    for (
      let visit = pending.pop();
      visit !== undefined;
      visit = pending.pop()
    ) {
      if (visit.required && failed.has(visit.file)) {
        return undefined;
      }
      if (loaded.has(visit.file) || failed.has(visit.file)) {
        continue;
      }
      const read = yield* readVisit(sources, module, visit);
      if (read === "abort") {
        return undefined;
      }
      if (read === "left out") {
        failed.add(visit.file);
        continue;
      }
      const { listed, next } = read;
      loaded.set(visit.file, listed);
      pending.push(...next);
    }
    return loaded;
  });

/** The names `entry` may export: its own, and those of the files its `export *` reaches (not their `default`). */
const candidateNames = (
  { loaded, fileOf }: ExportWorld,
  entry: string,
): ReadonlySet<string> => {
  const names = new Set<string>();
  const visited = new Set<string>();
  const pending = [entry];
  for (let file = pending.pop(); file !== undefined; file = pending.pop()) {
    const listed = loaded.get(file);
    if (visited.has(file) || listed === undefined) {
      continue;
    }
    visited.add(file);
    for (const { name } of listed.names) {
      if (file === entry || name !== "default") {
        names.add(name);
      }
    }
    for (const specifier of listed.forwarded) {
      const target = fileOf(file, specifier);
      if (target !== undefined) {
        pending.push(target);
      }
    }
  }
  return names;
};

/**
 * The number of distinct names `entryPoints` export, all of them files of
 * `module`: a name counts once however many entry points export it. Within an
 * entry point, the names of its own and of the files it forwards with
 * `export * from` (relative specifiers, transitively, `default` left out); a
 * name that two `export *` sources export as different bindings, and that the
 * file does not export itself, is not exported. Undefined when that cannot be
 * told exactly: a file is read by no adapter, unreadable or unlistable, a
 * forwarded specifier does not name exactly one file of the module, or two
 * bindings of a name cannot be told apart.
 */
export const countExportedNames = (
  sources: SymbolSources,
  module: string,
  entryPoints: ReadonlyArray<string>,
): Effect.Effect<
  number | undefined,
  never,
  FileSystem.FileSystem | Path.Path
> =>
  Effect.gen(function* () {
    const loaded = yield* loadExports(sources, module, entryPoints);
    if (loaded === undefined) {
      return undefined;
    }
    const world: ExportWorld = {
      loaded,
      fileOf: (from, specifier) => fileNamedBy(sources, from, specifier),
    };
    const exported = new Set<string>();
    for (const entry of entryPoints) {
      for (const name of candidateNames(world, entry)) {
        const { kind } = resolveExport(world, entry, name);
        if (kind === "unknown") {
          return undefined;
        }
        if (kind === "binding") {
          exported.add(name);
        }
      }
    }
    return exported.size;
  });
