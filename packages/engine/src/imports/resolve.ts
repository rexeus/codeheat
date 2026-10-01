// Owns resolving a module specifier, as written in a file, to universe files.
// Relative specifiers follow TypeScript's rules (extension, `index`, `.js` for
// `.ts`); a workspace package name stands for the package's entry points.
// A specifier is either accounted for or unresolved. Unresolved ones (tsconfig
// path aliases, `#` subpath imports, code that is not in the universe) mean
// the file may depend on code we cannot see.
import { isAccountedExternal, splitPackageName } from "./external-modules.js";
import {
  candidatesFor,
  directoryOf,
  isAssetPath,
  isRelative,
  joinPath,
  withoutQuery,
} from "./relative-path.js";

/** A package of the repository, importable by the `name` in its manifest. */
export type WorkspacePackage = {
  /** Repository-relative directory of the package. */
  readonly directory: string;
  /** The universe files that importing the package by its name reaches. */
  readonly entryPoints: ReadonlyArray<string>;
};

/** What a specifier refers to. */
type Resolution = {
  /** The universe files it refers to; none for an external or asset import. */
  readonly files: ReadonlyArray<string>;
  /** Whether the specifier is accounted for: it refers to `files`, or to something that is no code of ours (a built-in, a declared dependency, an image). */
  readonly resolved: boolean;
};

/** Resolves `specifier`, written in the file `from`. */
export type Resolver = (from: string, specifier: string) => Resolution;

/** What resolving needs to know about the repository. */
export type ResolveWorld = {
  /** Every universe file. */
  readonly universe: ReadonlySet<string>;
  /** Every file git tracks in the analyzed scope, whether it is in the universe or not. */
  readonly tracked: ReadonlySet<string>;
  readonly packages: ReadonlyMap<string, WorkspacePackage>;
  /** Dependency names declared by the repository's manifests. */
  readonly dependencies: ReadonlySet<string>;
};

const UNRESOLVED: Resolution = { files: [], resolved: false };
const ACCOUNTED: Resolution = { files: [], resolved: true };

export const createResolver = (world: ResolveWorld): Resolver => {
  const { universe, tracked, packages, dependencies } = world;

  /** The first candidate in the universe; unresolved when only an excluded file or nothing exists. */
  const code = (base: string | undefined): Resolution => {
    const candidates = base === undefined ? [] : candidatesFor(base);
    const found = candidates.find((candidate) => universe.has(candidate));
    return found === undefined
      ? UNRESOLVED
      : { files: [found], resolved: true };
  };

  const relative = (from: string, specifier: string): Resolution => {
    const target = joinPath(directoryOf(from), withoutQuery(specifier));
    if (target !== undefined && isAssetPath(target) && tracked.has(target)) {
      return ACCOUNTED;
    }
    return code(target);
  };

  const workspace = (
    { directory, entryPoints }: WorkspacePackage,
    subpath: string,
  ): Resolution => {
    if (subpath === "") {
      return entryPoints.length === 0
        ? UNRESOLVED
        : { files: entryPoints, resolved: true };
    }
    const direct = code(joinPath(directory, subpath));
    return direct.resolved
      ? direct
      : code(joinPath(directory, `src/${subpath}`));
  };

  return (from, specifier) => {
    if (isRelative(specifier)) {
      return relative(from, specifier);
    }
    const { name, subpath } = splitPackageName(specifier);
    const workspacePackage = packages.get(name);
    if (workspacePackage !== undefined) {
      return workspace(workspacePackage, subpath);
    }
    return isAccountedExternal(specifier, dependencies)
      ? ACCOUNTED
      : UNRESOLVED;
  };
};
