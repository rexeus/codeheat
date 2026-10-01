// Owns resolving a module specifier, as written in a file, to universe files.
// Relative specifiers follow TypeScript's rules (extension, `index`, `.js` for
// `.ts`); a workspace package name stands for the package's entry points.
// Anything else — Node built-ins, installed packages, tsconfig path aliases —
// resolves to nothing.

/** A package of the repository, importable by the `name` in its manifest. */
export type WorkspacePackage = {
  /** Repository-relative directory of the package. */
  readonly directory: string;
  /** The universe files that make up the package's public interface. */
  readonly entryPoints: ReadonlyArray<string>;
};

/** The universe files `specifier`, written in `from`, may refer to; none when it leaves the universe. */
export type Resolver = (
  from: string,
  specifier: string,
) => ReadonlyArray<string>;

/** What TypeScript tries in place of a runtime extension, in its order. */
const SOURCE_FOR_RUNTIME_EXTENSION: ReadonlyMap<
  string,
  ReadonlyArray<string>
> = new Map([
  [".js", [".ts", ".tsx", ".d.ts"]],
  [".jsx", [".tsx"]],
  [".mjs", [".mts", ".d.mts"]],
  [".cjs", [".cts", ".d.cts"]],
]);
const APPENDED_EXTENSIONS = [
  ".ts",
  ".tsx",
  ".d.ts",
  ".mts",
  ".cts",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
];

/** Joins POSIX segments, resolving `.` and `..`; undefined when the result leaves the repository. */
const join = (directory: string, relative: string): string | undefined => {
  const segments = directory === "." ? [] : directory.split("/");
  for (const segment of relative.split("/")) {
    if (segment === "..") {
      if (segments.pop() === undefined) {
        return undefined;
      }
    } else if (segment !== "." && segment !== "") {
      segments.push(segment);
    }
  }
  return segments.join("/");
};

const directoryOf = (file: string): string =>
  file.includes("/") ? file.slice(0, file.lastIndexOf("/")) : ".";

const isRelative = (specifier: string): boolean =>
  specifier === "." ||
  specifier === ".." ||
  specifier.startsWith("./") ||
  specifier.startsWith("../");

/** `name` of a bare specifier, and what follows it: `@a/b/c` is `@a/b` plus `c`. */
const splitPackageName = (
  specifier: string,
): { readonly name: string; readonly subpath: string } => {
  const parts = specifier.split("/");
  const nameLength = specifier.startsWith("@") ? 2 : 1;
  return {
    name: parts.slice(0, nameLength).join("/"),
    subpath: parts.slice(nameLength).join("/"),
  };
};

/** The places a path without a known extension can be: itself, with an extension, or a directory with an `index`. */
const candidatesFor = (base: string): ReadonlyArray<string> => {
  const extensionStart = base.lastIndexOf(".");
  const extension = base.slice(extensionStart);
  const replacements =
    extensionStart > base.lastIndexOf("/")
      ? (SOURCE_FOR_RUNTIME_EXTENSION.get(extension) ?? [])
      : [];
  return [
    ...replacements.map((source) => base.slice(0, extensionStart) + source),
    base,
    ...APPENDED_EXTENSIONS.map((appended) => base + appended),
    ...APPENDED_EXTENSIONS.map((appended) => `${base}/index${appended}`),
  ];
};

/**
 * Builds the resolver for a universe and the packages named in its manifests.
 *
 * A relative specifier resolves to the first existing candidate, as the
 * TypeScript compiler picks it. A package name resolves to all entry points
 * of that package (an `exports` map cannot tell which one is meant); its
 * subpath resolves like a relative path under the package or its `src/`.
 */
export const createResolver = (
  universe: ReadonlySet<string>,
  packages: ReadonlyMap<string, WorkspacePackage>,
): Resolver => {
  const firstExisting = (base: string | undefined): ReadonlyArray<string> => {
    const found =
      base === undefined
        ? undefined
        : candidatesFor(base).find((candidate) => universe.has(candidate));
    return found === undefined ? [] : [found];
  };
  return (from, specifier) => {
    if (isRelative(specifier)) {
      return firstExisting(join(directoryOf(from), specifier));
    }
    const { name, subpath } = splitPackageName(specifier);
    const workspacePackage = packages.get(name);
    if (workspacePackage === undefined) {
      return [];
    }
    if (subpath === "") {
      return workspacePackage.entryPoints;
    }
    const { directory } = workspacePackage;
    const direct = firstExisting(join(directory, subpath));
    return direct.length > 0
      ? direct
      : firstExisting(join(directory, `src/${subpath}`));
  };
};
