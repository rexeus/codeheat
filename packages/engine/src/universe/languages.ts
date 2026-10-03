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
