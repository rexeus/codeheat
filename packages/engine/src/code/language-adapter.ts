// Owns the seam between the engine and the languages it can read code of.
// One adapter per language, selected by file extension; the engine never
// parses anything itself, the adapters bring their parser with them.

/** The modules one file depends on, as written in its source. */
export type SourceImports = {
  /** Specifiers of static imports, dynamic `import("…")` with a literal, and `require("…")`. */
  readonly imports: ReadonlyArray<string>;
  /** Specifiers of `export … from "…"`: importing this file reaches them too. */
  readonly reexports: ReadonlyArray<string>;
  /**
   * The file also loads modules by an expression (`import(name)`,
   * `require(name)`), so it depends on modules that no specifier names.
   */
  readonly computed: boolean;
};

/** The symbols one file exports, as written in its source. */
export type SourceExports = {
  /**
   * Distinct names the file exports on its own account: declarations,
   * `export { a as b }`, `export { x } from "…"`, `export * as ns from "…"`.
   * The default export is named `default`.
   */
  readonly names: ReadonlyArray<string>;
  /**
   * Specifiers of `export * from "…"`: each adds every name the module it
   * names exports, except `default`, which `export *` never forwards.
   */
  readonly forwarded: ReadonlyArray<string>;
};

/** Reads the dependencies and the public symbols of the files of one language. */
export type LanguageAdapter = {
  /** Lower-case file extensions without the dot that the adapter reads. */
  readonly extensions: ReadonlyArray<string>;
  /**
   * The modules `source` depends on, or undefined when it cannot be parsed:
   * an unparseable file has unknown dependencies, which is not the same as none.
   */
  readonly imports: (file: string, source: string) => SourceImports | undefined;
  /**
   * The symbols `source` exports, or undefined when they cannot be listed
   * exactly: the file does not parse, or exports in a way the adapter cannot
   * enumerate (CommonJS, `export =`). An unlistable file has unknown exports,
   * which is not the same as none.
   */
  readonly exports: (file: string, source: string) => SourceExports | undefined;
  /**
   * Whether a file with this `source` may forward other modules (re-export
   * them). A file imported by another is read only when it may; the rest
   * cannot change what the importer reaches, so the adapter can skip the
   * expensive parse. Err towards true.
   */
  readonly canReexport: (source: string) => boolean;
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
