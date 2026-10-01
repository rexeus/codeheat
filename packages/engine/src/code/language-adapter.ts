// Owns the seam between the engine and the languages it can read code of.
// One adapter per language, selected by file extension; the engine never
// parses anything itself, the adapters bring their parser with them.

/** The modules one file depends on, as written in its source. */
export type SourceImports = {
  /** Specifiers of static imports, dynamic `import("…")` with a literal, and `require("…")`. */
  readonly imports: ReadonlyArray<string>;
  /** Specifiers of `export … from "…"`: importing this file reaches them too. */
  readonly reexports: ReadonlyArray<string>;
};

/** Reads the dependencies of the files of one language. */
export type LanguageAdapter = {
  /** Lower-case file extensions without the dot that the adapter reads. */
  readonly extensions: ReadonlyArray<string>;
  /**
   * The modules `source` depends on, or undefined when it cannot be parsed:
   * an unparseable file has unknown dependencies, which is not the same as none.
   */
  readonly imports: (file: string, source: string) => SourceImports | undefined;
};

/** The adapter that reads files with `path`'s extension, if any. */
export const adapterFor = (
  adapters: ReadonlyArray<LanguageAdapter>,
  path: string,
): LanguageAdapter | undefined => {
  const dot = path.lastIndexOf(".");
  if (dot <= path.lastIndexOf("/") + 1) {
    return undefined;
  }
  const extension = path.slice(dot + 1).toLowerCase();
  return adapters.find((adapter) => adapter.extensions.includes(extension));
};
