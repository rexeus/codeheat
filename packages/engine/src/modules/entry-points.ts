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
/** What a package.json can name as interface: JavaScript and TypeScript sources (declaration files included), not configuration. */
const CODE_FILE = /\.[cm]?[jt]sx?$/u;
const CONFIG_FILE = /\.config\.[cm]?[jt]s$/u;
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

/** A tool's configuration (`eslint.config.mjs`): code, but neither interface nor implementation of a module. */
export const isConfigFile = (file: string): boolean => CONFIG_FILE.test(file);

const isManifestCode = (file: string): boolean =>
  CODE_FILE.test(file) && !isConfigFile(file);

const isConventionalEntry = (module: string, file: string): boolean =>
  [module, joinPath(module, "src")].includes(directoryOf(file)) &&
  CONVENTIONAL_ENTRY.test(nameOf(file));

const escapeRegExp = (text: string): string =>
  text.replaceAll(/[.+?^${}()|[\]\\]/gu, String.raw`\$&`);

/** The files among `candidates` that equal `pattern`, or match it when it holds a `*`, which, as in `exports`, stands for any characters, `/` included. */
const matching = (
  pattern: string,
  candidates: ReadonlyArray<string>,
): ReadonlyArray<string> => {
  const wildcard = new RegExp(
    `^${pattern
      .split("*")
      .map((part) => escapeRegExp(part))
      .join(".*")}$`,
    "u",
  );
  return candidates.filter((candidate) => wildcard.test(candidate));
};

/**
 * The module files a manifest target stands for: the files it names or, with a
 * `*`, matches; else the files with its stem (a target without extension); else,
 * for a target in `dist/` or `build/`, the sources with the same stem under the
 * module's `src/` (else its root). `files` are the candidates it may name.
 */
const resolveTarget = (
  module: string,
  target: string,
  files: ReadonlyArray<string>,
): ReadonlyArray<string> => {
  const relative = target.replace(/^\.\//u, "");
  const named = matching(joinPath(module, relative), files);
  if (named.length > 0) {
    return named;
  }
  const build = BUILD_DIRECTORIES.find((directory) =>
    relative.startsWith(directory),
  );
  const builtStem = stemOf(relative.slice((build ?? "").length));
  const stems = [
    joinPath(module, relative),
    ...(build === undefined
      ? []
      : [joinPath(module, `src/${builtStem}`), joinPath(module, builtStem)]),
  ];
  const stemmed = stems.map((stem) =>
    files.filter((file) => matching(stem, [stemOf(file)]).length > 0),
  );
  return stemmed.find((matches) => matches.length > 0) ?? [];
};

const detectEntryPoints = (
  module: string,
  files: ReadonlyArray<string>,
  targets: ReadonlyArray<string>,
): ReadonlyArray<string> => {
  const code = files.filter((file) => isManifestCode(file));
  return [
    ...new Set([
      ...targets.flatMap((target) => resolveTarget(module, target, code)),
      ...files.filter((file) => isConventionalEntry(module, file)),
    ]),
  ].toSorted(Order.String);
};

/** The universe files of each module, with the kind of the module. */
export const groupByModule = (
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
 * The files that importing the package of `module` by its bare name reaches:
 * what `rootTargets` (see `ManifestFacts`) resolve to among `files`, else the
 * conventional `index` files; empty when neither exists. Unlike
 * `findEntryPoints`, it knows nothing of `--entry`.
 */
export const packageMainEntries = (
  module: string,
  rootTargets: ReadonlyArray<string>,
  files: ReadonlyArray<string>,
): ReadonlyArray<string> => {
  const code = files.filter((file) => isManifestCode(file));
  const named = rootTargets.flatMap((target) =>
    resolveTarget(module, target, code),
  );
  const found =
    named.length > 0
      ? named
      : files.filter((file) => isConventionalEntry(module, file));
  return [...new Set(found)].toSorted(Order.String);
};

/**
 * Finds the entry points of every module, keyed by module path (a module
 * without any maps to an empty list). `modules` assigns the universe files to
 * their modules; `root` is the repository root manifests are read under.
 *
 * Without `globs`, a package's entry points are the files its `package.json`
 * names in `exports`, `main`, `module`, and `types`, as far as they are
 * JavaScript or TypeScript files and no `*.config.*` files (a target in `dist/` or
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
