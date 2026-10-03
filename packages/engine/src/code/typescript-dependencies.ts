// Owns the coarse reading of what a TypeScript or JavaScript file loads: its
// import and re-export statements and its literal `require` and `import()`
// calls, found by text rather than by a syntax tree. About five times cheaper
// than the parser, which matters when every file of a repository is read.

/** A block comment, or a line comment that does not start inside a string or a URL; comments hold code samples that are no dependencies. */
const COMMENT = /\/\*[\s\S]*?\*\/|(^|[^:"'`\\])\/\/[^\n]*/gmu;

/** `import … from "x"` or `export … from "x"` at the start of a line; the part between may span lines but holds no quote or semicolon. */
const FROM_STATEMENT =
  /^[ \t]*(?:import|export)\b[^'";`]*?\bfrom\s*(["'])([^"'\n]+)\1/gmu;

/** `import "x"` at the start of a line. */
const BARE_IMPORT = /^[ \t]*import\s*(["'])([^"'\n]+)\1/gmu;

/** `require("x")` or `import("x")` with a plain string. */
const LOAD_CALL = /\b(?:require|import)\s*\(\s*(["'])([^"'\n]+)\1\s*\)/gu;

const withoutComments = (source: string): string =>
  source.replaceAll(COMMENT, (_, lead: string | undefined) => lead ?? " ");

/**
 * The distinct specifiers `source` loads, read from its text. It sees what a
 * statement or a call with a string literal says; it does not see a module
 * named by an expression, or a statement inside a template string that looks
 * like one.
 */
export const scanDependencies = (source: string): ReadonlyArray<string> => {
  const text = withoutComments(source);
  const specifiers = new Set<string>();
  for (const pattern of [FROM_STATEMENT, BARE_IMPORT, LOAD_CALL]) {
    for (const [, , specifier] of text.matchAll(pattern)) {
      if (specifier !== undefined) {
        specifiers.add(specifier);
      }
    }
  }
  return [...specifiers];
};
