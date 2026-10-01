// Owns reading the imports of TypeScript and JavaScript files through a parser
// the caller injects, so the engine itself carries no parser dependency.
import type { LanguageAdapter, SourceImports } from "./language-adapter.js";
import { modulesInAst } from "./typescript-ast.js";
import { exportedSymbols } from "./typescript-symbols.js";
import type { StaticExports, StaticImports } from "./typescript-symbols.js";

/**
 * The part of the result of oxc-parser's `parseSync` that the adapter reads,
 * written out so the engine needs no parser package. `program` is the ESTree
 * AST, consulted only for module names the module record lacks.
 */
type ParsedModule = {
  readonly errors: ReadonlyArray<unknown>;
  readonly module: {
    readonly staticImports: StaticImports;
    readonly staticExports: StaticExports;
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
/** Sources without this text have nothing the AST would add: no `require`, no `import.meta`, no `new URL(…)`, no `export =`. */
const MENTIONS_AST_ONLY =
  /\brequire\s*[(.]|\bimport\.meta\b|\bnew\s+URL\s*\(|\bexport\s*=|\bexport\s+import\b|\bexports\b/u;
/** In TypeScript, `import("x").T` is a type that only the AST shows. */
const MENTIONS_IMPORT_CALL = /\bimport\s*\(/u;
/** A source without `export` in it, as in `exports` or `__export`, exports nothing. */
const MENTIONS_EXPORT = /export/u;
/** A source without any of these loads no module, so it has none to forward. */
const MENTIONS_MODULE = /\b(?:import|require|from)\b|\bnew\s+URL\b/u;
/** A string literal without escapes or template holes. */
const PLAIN_LITERAL = /^(["'`])([^"'`$\\]*)\1$/u;

const extensionOf = (file: string): string =>
  file.slice(file.lastIndexOf(".") + 1).toLowerCase();

/** The parser reports `export { a, b } from "x"` once per name. */
const unique = (specifiers: ReadonlyArray<string>): ReadonlyArray<string> => [
  ...new Set(specifiers),
];

/** Whether the module record leaves open what the file hands on: it exports something it did not import, and loads something. */
const mayHandOn = (module: ParsedModule["module"]): boolean =>
  (module.staticImports.length > 0 || module.dynamicImports.length > 0) &&
  module.staticExports.some(({ entries }) =>
    entries.some(({ moduleRequest }) => moduleRequest === null),
  );

const needsAst = (
  parsed: ParsedModule,
  file: string,
  source: string,
): boolean =>
  MENTIONS_AST_ONLY.test(source) ||
  mayHandOn(parsed.module) ||
  (TYPESCRIPT_EXTENSIONS.has(extensionOf(file)) &&
    MENTIONS_IMPORT_CALL.test(source));

/**
 * The specifiers of the imports whose bindings a file exports without `from`:
 * `import a from "x"; export default a;`, `import * as n from "x"; export { n };`.
 */
const reexportedBindings = (module: ParsedModule["module"]): Array<string> => {
  const specifierOf = new Map(
    module.staticImports.flatMap(({ moduleRequest, entries }) =>
      entries.map(
        ({ localName }) => [localName.value, moduleRequest.value] as const,
      ),
    ),
  );
  return module.staticExports.flatMap(({ entries }) =>
    entries.flatMap(({ moduleRequest, localName }) => {
      const specifier =
        moduleRequest === null && localName.name !== null
          ? specifierOf.get(localName.name)
          : undefined;
      return specifier === undefined ? [] : [specifier];
    }),
  );
};

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
  const imported = new Map(
    staticImports.flatMap(({ moduleRequest, entries }) =>
      entries.map(
        ({ localName }) => [localName.value, moduleRequest.value] as const,
      ),
    ),
  );
  const fromAst = needsAst(parsed, file, source)
    ? modulesInAst(parsed.program, imported)
    : { specifiers: [], computed: false, handedOn: [] };
  return {
    imports: unique([
      ...staticImports.map(({ moduleRequest }) => moduleRequest.value),
      ...dynamic.filter((specifier) => specifier !== undefined),
      ...fromAst.specifiers,
    ]),
    reexports: unique([
      ...staticExports.flatMap(({ entries }) =>
        entries.flatMap(({ moduleRequest }) =>
          moduleRequest === null ? [] : [moduleRequest.value],
        ),
      ),
      ...reexportedBindings(parsed.module),
      ...fromAst.handedOn,
    ]),
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

/** Applies `read` to the parse of `source`; undefined when it has syntax errors or the parser throws. */
const readParsed = <A>(
  parse: ParseModule,
  file: string,
  source: string,
  read: (parsed: ParsedModule) => A,
): A | undefined => {
  try {
    const parsed = parseWithJsxFallback(parse, file, source);
    return parsed.errors.length === 0 ? read(parsed) : undefined;
  } catch {
    return undefined;
  }
};

/**
 * Reads TypeScript and JavaScript (`.ts .tsx .mts .cts .js .jsx .mjs .cjs`)
 * with `parse`. Type-only imports count, since the file still depends on the
 * module. A file with syntax errors, or one the parser throws on, is unknown.
 * `computed` is set when the file loads a module by an expression:
 * `import(name)`, `` import(`./${name}`) ``, `require(name)`, `import.meta.glob()`,
 * or `require.context()`.
 *
 * A file re-exports a module when it says `export … from`, exports a binding
 * it imported (`import a from "x"; export default a;`), or hands it on inside
 * an exported expression: the initializer of an exported variable, an
 * `export default` expression, `export =`, `module.exports = …`, `exports.x = …`
 * (see `handedOn`). Use inside the body of an exported function is not.
 *
 * `exports` lists the names the module record shows (`export * from` apart,
 * see `SourceExports`). A file that also exports without ES syntax
 * (`export =`, `module.exports`, `exports.x`) is unlistable, and so is one
 * with syntax errors.
 */
export const typescriptAdapter = (parse: ParseModule): LanguageAdapter => ({
  extensions: EXTENSIONS,
  imports: (file, source) =>
    readParsed(parse, file, source, (parsed) =>
      sourceImports(parsed, file, source),
    ),
  exports: (file, source) =>
    readParsed(parse, file, source, ({ module, program }) =>
      exportedSymbols(module, program, source),
    ),
  canReexport: (source) =>
    MENTIONS_EXPORT.test(source) && MENTIONS_MODULE.test(source),
});
