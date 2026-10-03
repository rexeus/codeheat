// Owns the default answer to "is this a source file?": a language allow-list.
// `--include` replaces it, so prose and data formats stay out unless asked for.

const SOURCE_EXTENSIONS: ReadonlySet<string> = new Set([
  // JavaScript family
  "ts",
  "tsx",
  "mts",
  "cts",
  "js",
  "jsx",
  "mjs",
  "cjs",
  "vue",
  "svelte",
  "astro",
  // systems
  "c",
  "h",
  "cc",
  "cpp",
  "cxx",
  "hpp",
  "hh",
  "rs",
  "go",
  "zig",
  // JVM and .NET
  "java",
  "kt",
  "kts",
  "scala",
  "groovy",
  "cs",
  "fs",
  // scripting
  "py",
  "rb",
  "php",
  "pl",
  "lua",
  "r",
  "jl",
  "sh",
  "bash",
  "zsh",
  "ps1",
  // functional and others
  "ex",
  "exs",
  "erl",
  "hs",
  "ml",
  "clj",
  "elm",
  "swift",
  "m",
  "mm",
  "dart",
  "sol",
  // data and markup that hold logic
  "sql",
  "html",
  "css",
  "scss",
  "less",
  "tf",
]);

/** Whether the path's extension belongs to a source language. */
export const isSourceLanguage = (path: string): boolean => {
  const extensionStart = path.lastIndexOf(".");
  return (
    extensionStart > path.lastIndexOf("/") + 1 &&
    SOURCE_EXTENSIONS.has(path.slice(extensionStart + 1).toLowerCase())
  );
};

/**
 * Extensions of languages in which indentation or line layout is syntax, so
 * moving a line to another indentation level changes what the code does.
 * Includes formats that `--include` can bring into the universe.
 */
const INDENTATION_SIGNIFICANT_EXTENSIONS: ReadonlySet<string> = new Set([
  // Python and its dialects (Cython, Starlark: Bazel, Buck, Tilt)
  "py",
  "pyi",
  "pyw",
  "pyx",
  "pxd",
  "bzl",
  "star",
  // F#, Haskell, and relatives
  "fs",
  "fsi",
  "fsx",
  "hs",
  "lhs",
  "elm",
  "purs",
  "idr",
  // Scala 3 (significant indentation), Nim, Mojo, GDScript
  "scala",
  "sc",
  "nim",
  "nims",
  "mojo",
  "gd",
  // CoffeeScript, YAML, and indentation-based markup and style languages
  "coffee",
  "litcoffee",
  "yaml",
  "yml",
  "haml",
  "pug",
  "jade",
  "slim",
  "sass",
  "styl",
  // Make: a tab is syntax
  "mk",
  "mak",
  "make",
]);

/** Files known by their name, not their extension; the match is exact. */
const INDENTATION_SIGNIFICANT_FILE_NAMES: ReadonlySet<string> = new Set([
  "Makefile",
  "makefile",
  "GNUmakefile",
  "Makefile.am",
  "Makefile.in",
  "BUILD",
  "BUILD.bazel",
  "WORKSPACE",
  "WORKSPACE.bazel",
  "Tiltfile",
  "Snakefile",
  "SConstruct",
  "SConscript",
]);

/** Whether whitespace changes in the file can change what it does (see `INDENTATION_SIGNIFICANT_EXTENSIONS`). */
export const isIndentationSignificant = (path: string): boolean => {
  const name = path.slice(path.lastIndexOf("/") + 1);
  const extensionStart = name.lastIndexOf(".");
  return (
    INDENTATION_SIGNIFICANT_FILE_NAMES.has(name) ||
    (extensionStart > 0 &&
      INDENTATION_SIGNIFICANT_EXTENSIONS.has(
        name.slice(extensionStart + 1).toLowerCase(),
      ))
  );
};
