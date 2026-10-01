// Owns which files form each module's public interface: what its package.json
// names and the conventional entry files, or the files the user points at.
import { Effect, Order, Path } from "effect";
import type { FileSystem } from "effect";

import { matchesAny } from "../universe/globs.js";
import type { ModuleRef } from "./detect.js";
import { readManifestTargets } from "./package-manifest.js";

/** `index` of the JavaScript family (not `index.test.ts`, not `index.html`), Rust and Python module roots. */
const CONVENTIONAL_ENTRY =
  /^(index\.[cm]?[jt]sx?|mod\.rs|lib\.rs|__init__\.py)$/u;
/** Where a manifest points at build output rather than at the source that produces it. */
const BUILD_DIRECTORIES = ["dist/", "build/"];

type ModuleFiles = {
  readonly kind: ModuleRef["kind"];
  readonly files: ReadonlyArray<string>;
};

const joinPath = (directory: string, relative: string): string =>
  directory === "." ? relative : `${directory}/${relative}`;

const directoryOf = (file: string): string =>
  file.includes("/") ? file.slice(0, file.lastIndexOf("/")) : ".";

const nameOf = (file: string): string => file.slice(file.lastIndexOf("/") + 1);

/** The path without its extension, `.d.ts` included, so `dist/a.d.ts` and `src/a.ts` share a stem. */
const stemOf = (file: string): string => file.replace(/(\.d)?\.[^./]+$/u, "");

const isConventionalEntry = (module: string, file: string): boolean =>
  [module, joinPath(module, "src")].includes(directoryOf(file)) &&
  CONVENTIONAL_ENTRY.test(nameOf(file));

/**
 * The module files a manifest target stands for: the file itself, or, for a
 * target in `dist/` or `build/`, the sources with the same stem under the
 * module's `src/` (else its root).
 */
const resolveTarget = (
  module: string,
  target: string,
  files: ReadonlyArray<string>,
): ReadonlyArray<string> => {
  const relative = target.replace(/^\.\//u, "");
  const direct = joinPath(module, relative);
  if (files.includes(direct)) {
    return [direct];
  }
  const build = BUILD_DIRECTORIES.find((directory) =>
    relative.startsWith(directory),
  );
  if (build === undefined) {
    return [];
  }
  const stem = stemOf(relative.slice(build.length));
  const sourceStems = [joinPath(module, `src/${stem}`), joinPath(module, stem)];
  const sources = sourceStems.map((sourceStem) =>
    files.filter((file) => stemOf(file) === sourceStem),
  );
  return sources.find((matches) => matches.length > 0) ?? [];
};

const detectEntryPoints = (
  module: string,
  files: ReadonlyArray<string>,
  targets: ReadonlyArray<string>,
): ReadonlyArray<string> =>
  [
    ...new Set([
      ...targets.flatMap((target) => resolveTarget(module, target, files)),
      ...files.filter((file) => isConventionalEntry(module, file)),
    ]),
  ].toSorted(Order.String);

const groupByModule = (
  modules: ReadonlyMap<string, ModuleRef>,
): ReadonlyMap<string, ModuleFiles> => {
  const grouped = new Map<
    string,
    { kind: ModuleRef["kind"]; files: string[] }
  >();
  for (const [file, { path, kind }] of modules) {
    const group = grouped.get(path) ?? { kind, files: [] };
    group.files.push(file);
    grouped.set(path, group);
  }
  return grouped;
};

/**
 * Finds the entry points of every module, keyed by module path (a module
 * without any maps to an empty list). `modules` assigns the universe files to
 * their modules; `root` is the repository root manifests are read under.
 *
 * Without `globs`, a package's entry points are the files its `package.json`
 * names in `exports`, `main`, `module`, and `types` (a target in `dist/` or
 * `build/` stands for the same-stem source under the package's `src/` or root,
 * when one exists), plus `index.<ts|js|…>`, `mod.rs`, `lib.rs`, and `__init__.py` at
 * the module root or its `src/`. Directory modules use the conventional files
 * only. Non-empty `globs` replace all of that: entry points are the module
 * files matching any glob.
 */
export const findEntryPoints = (
  root: string,
  modules: ReadonlyMap<string, ModuleRef>,
  globs: ReadonlyArray<string>,
): Effect.Effect<
  ReadonlyMap<string, ReadonlyArray<string>>,
  never,
  FileSystem.FileSystem | Path.Path
> =>
  Effect.gen(function* () {
    const path = yield* Path.Path;
    const isEntry = matchesAny(globs);
    const entryPoints = new Map<string, ReadonlyArray<string>>();
    for (const [module, { kind, files }] of groupByModule(modules)) {
      if (globs.length > 0) {
        entryPoints.set(
          module,
          files.filter((file) => isEntry(file)).toSorted(Order.String),
        );
        continue;
      }
      const targets =
        kind === "package"
          ? yield* readManifestTargets(path.join(root, module, "package.json"))
          : [];
      entryPoints.set(module, detectEntryPoints(module, files, targets));
    }
    return entryPoints;
  });
