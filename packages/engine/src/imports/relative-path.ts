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
/**
 * Extensions of files that hold code; any other file is an asset. Component
 * formats (`.vue`, `.svelte`, `.astro`, `.mdx`) are code that no adapter reads
 * but that can import, so they are not assets.
 */
const CODE_EXTENSIONS = new Set([
  ...APPENDED_EXTENSIONS.map((e) => e.slice(1)),
  "vue",
  "svelte",
  "astro",
  "mdx",
]);

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

/** A file name that ends in a code extension, which a bare specifier may leave out. */
const CODE_FILE_NAME = /\.(?:d\.)?(?:[cm]?[jt]s|[jt]sx)$/u;

/**
 * The names a bare specifier could resolve to in `paths`: every directory
 * name, and the name of every code file without its code extension
 * (`events.ts`, `events.d.ts`, but not `events.spec.ts` or `events.css`).
 */
export const namesOf = (paths: Iterable<string>): ReadonlySet<string> => {
  const names = new Set<string>();
  for (const path of paths) {
    const segments = path.split("/");
    const file = segments.pop() ?? "";
    for (const segment of segments) {
      names.add(segment);
    }
    if (CODE_FILE_NAME.test(file)) {
      names.add(file.replace(CODE_FILE_NAME, ""));
    }
  }
  return names;
};

/** Whether `path` has an extension that is not a code file's: an image, a stylesheet, JSON. */
export const isAssetPath = (path: string): boolean => {
  const dot = path.lastIndexOf(".");
  return (
    dot > path.lastIndexOf("/") + 1 &&
    !CODE_EXTENSIONS.has(path.slice(dot + 1).toLowerCase())
  );
};

/**
 * The places that a path can stand for, in the order the stages are tried; the
 * files of the first stage that has any are the ones meant. A runtime extension
 * (`./a.js`) stands for its TypeScript source and the file itself, but only
 * when the importer is TypeScript, which maps `.js` to `.ts`; otherwise for the
 * file itself. A path without one stands for the path with any code extension,
 * and failing that for a directory's `index`.
 */
export const candidateStages = (
  base: string,
  importerIsTypeScript: boolean,
): ReadonlyArray<ReadonlyArray<string>> => {
  const extensionStart = base.lastIndexOf(".");
  const sources =
    importerIsTypeScript && extensionStart > base.lastIndexOf("/")
      ? (SOURCE_FOR_RUNTIME_EXTENSION.get(base.slice(extensionStart)) ?? [])
      : [];
  return [
    [...sources.map((source) => base.slice(0, extensionStart) + source), base],
    APPENDED_EXTENSIONS.map((appended) => base + appended),
    APPENDED_EXTENSIONS.map((appended) => `${base}/index${appended}`),
  ];
};

/** Whether `file` is TypeScript, whose importers read `.js` as the `.ts` beside it. */
export const isTypeScriptFile = (file: string): boolean =>
  /\.[cm]?tsx?$/u.test(file);
