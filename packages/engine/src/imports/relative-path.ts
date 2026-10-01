// Owns the path arithmetic of relative module specifiers, with TypeScript's
// ways of finding the file behind a specifier.

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
/** Extensions of files that hold code a parser reads; any other file is an asset. */
const CODE_EXTENSIONS = new Set(APPENDED_EXTENSIONS.map((e) => e.slice(1)));

/** Joins POSIX segments, resolving `.` and `..`; undefined when the result leaves the repository. */
export const joinPath = (
  directory: string,
  relative: string,
): string | undefined => {
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

export const directoryOf = (file: string): string =>
  file.includes("/") ? file.slice(0, file.lastIndexOf("/")) : ".";

export const isRelative = (specifier: string): boolean =>
  specifier === "." ||
  specifier === ".." ||
  specifier.startsWith("./") ||
  specifier.startsWith("../");

/** The specifier without the `?query` or `#fragment` that bundlers read (`./icon.svg?url`). */
export const withoutQuery = (specifier: string): string =>
  specifier.replace(/[?#].*$/u, "");

/** Whether `path` has an extension that is not a code file's: an image, a stylesheet, JSON. */
export const isAssetPath = (path: string): boolean => {
  const dot = path.lastIndexOf(".");
  return (
    dot > path.lastIndexOf("/") + 1 &&
    !CODE_EXTENSIONS.has(path.slice(dot + 1).toLowerCase())
  );
};

/** The places a path without a known extension can be: itself, with an extension, or a directory with an `index`. */
export const candidatesFor = (base: string): ReadonlyArray<string> => {
  const extensionStart = base.lastIndexOf(".");
  const replacements =
    extensionStart > base.lastIndexOf("/")
      ? (SOURCE_FOR_RUNTIME_EXTENSION.get(base.slice(extensionStart)) ?? [])
      : [];
  return [
    ...replacements.map((source) => base.slice(0, extensionStart) + source),
    base,
    ...APPENDED_EXTENSIONS.map((appended) => base + appended),
    ...APPENDED_EXTENSIONS.map((appended) => `${base}/index${appended}`),
  ];
};
