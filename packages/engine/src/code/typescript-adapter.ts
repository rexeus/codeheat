// Owns reading the imports of TypeScript and JavaScript files through a parser
// the caller injects, so the engine itself carries no parser dependency.
import type { LanguageAdapter, SourceImports } from "./language-adapter.js";
import { modulesInAst } from "./typescript-ast.js";

/**
 * The part of the result of oxc-parser's `parseSync` that the adapter reads,
 * written out so the engine needs no parser package. `program` is the ESTree
 * AST, consulted only for module names the module record lacks.
 */
type ParsedModule = {
  readonly errors: ReadonlyArray<unknown>;
  readonly module: {
    readonly staticImports: ReadonlyArray<{
      readonly moduleRequest: { readonly value: string };
    }>;
    readonly staticExports: ReadonlyArray<{
      readonly entries: ReadonlyArray<{
        readonly moduleRequest: { readonly value: string } | null;
      }>;
    }>;
    readonly dynamicImports: ReadonlyArray<{
      readonly moduleRequest: { readonly start: number; readonly end: number };
    }>;
  };
  readonly program: unknown;
};

/** oxc-parser's `parseSync`: the file name selects the language, `lang` overrides it. */
export type ParseModule = (
  filename: string,
  source: string,
  options?: { readonly lang?: "jsx" },
) => ParsedModule;

const EXTENSIONS = ["ts", "tsx", "mts", "cts", "js", "jsx", "mjs", "cjs"];
const TYPESCRIPT_EXTENSIONS = new Set(["ts", "tsx", "mts", "cts"]);
/** JavaScript that parsers read without JSX unless told otherwise. */
const PLAIN_JAVASCRIPT = /\.(?:js|mjs|cjs)$/u;
/** Sources without this text name no module in a `require()` call, so their AST stays unread. */
const MENTIONS_REQUIRE = /\brequire\s*\(/u;
/** In TypeScript, `import("x").T` is a type that only the AST shows. */
const MENTIONS_IMPORT_CALL = /\bimport\s*\(/u;
/** A source that has no `export` or nothing to export from cannot forward another module. */
const MENTIONS_EXPORT = /\bexport/u;
const MENTIONS_SOURCE = /\bfrom\b|\brequire\s*\(/u;
/** A string literal without escapes or template holes. */
const PLAIN_LITERAL = /^(["'`])([^"'`$\\]*)\1$/u;

const extensionOf = (file: string): string =>
  file.slice(file.lastIndexOf(".") + 1).toLowerCase();

/** The parser reports `export { a, b } from "x"` once per name. */
const unique = (specifiers: ReadonlyArray<string>): ReadonlyArray<string> => [
  ...new Set(specifiers),
];

const needsAst = (file: string, source: string): boolean =>
  MENTIONS_REQUIRE.test(source) ||
  (TYPESCRIPT_EXTENSIONS.has(extensionOf(file)) &&
    MENTIONS_IMPORT_CALL.test(source));

const sourceImports = (
  parsed: ParsedModule,
  file: string,
  source: string,
): SourceImports => {
  const { staticImports, staticExports, dynamicImports } = parsed.module;
  const dynamic = dynamicImports.map(
    ({ moduleRequest }) =>
      PLAIN_LITERAL.exec(
        source.slice(moduleRequest.start, moduleRequest.end).trim(),
      )?.[2],
  );
  const fromAst = needsAst(file, source)
    ? modulesInAst(parsed.program)
    : { specifiers: [], computed: false };
  return {
    imports: unique([
      ...staticImports.map(({ moduleRequest }) => moduleRequest.value),
      ...dynamic.filter((specifier) => specifier !== undefined),
      ...fromAst.specifiers,
    ]),
    reexports: unique(
      staticExports.flatMap(({ entries }) =>
        entries.flatMap(({ moduleRequest }) =>
          moduleRequest === null ? [] : [moduleRequest.value],
        ),
      ),
    ),
    computed: fromAst.computed || dynamic.includes(undefined),
  };
};

/** Parses `source`; JSX in a `.js` file is common, so a failed parse of plain JavaScript is retried with JSX. */
const parseWithJsxFallback = (
  parse: ParseModule,
  file: string,
  source: string,
): ParsedModule => {
  const parsed = parse(file, source);
  return parsed.errors.length > 0 && PLAIN_JAVASCRIPT.test(file)
    ? parse(file, source, { lang: "jsx" })
    : parsed;
};

const readImports = (
  parse: ParseModule,
  file: string,
  source: string,
): SourceImports | undefined => {
  try {
    const parsed = parseWithJsxFallback(parse, file, source);
    return parsed.errors.length === 0
      ? sourceImports(parsed, file, source)
      : undefined;
  } catch {
    return undefined;
  }
};

/**
 * Reads TypeScript and JavaScript (`.ts .tsx .mts .cts .js .jsx .mjs .cjs`)
 * with `parse`. Type-only imports count, since the file still depends on the
 * module. A file with syntax errors, or one the parser throws on, is unknown.
 * `computed` is set when the file loads a module by an expression:
 * `import(name)`, `` import(`./${name}`) ``, or `require(name)`.
 */
export const typescriptAdapter = (parse: ParseModule): LanguageAdapter => ({
  extensions: EXTENSIONS,
  imports: (file, source) => readImports(parse, file, source),
  canReexport: (source) =>
    MENTIONS_EXPORT.test(source) && MENTIONS_SOURCE.test(source),
});
