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
      readonly entries: ReadonlyArray<{
        readonly localName: { readonly value: string };
      }>;
    }>;
    readonly staticExports: ReadonlyArray<{
      readonly entries: ReadonlyArray<{
        readonly moduleRequest: { readonly value: string } | null;
        readonly localName: {
          readonly kind: string;
          readonly name: string | null;
        };
        readonly exportName: { readonly kind: string };
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
/** Sources without this text have nothing the AST would add: no `require`, no `import.meta`, no `new URL(…)`, no `export =`. */
const MENTIONS_AST_ONLY =
  /\brequire\s*[(.]|\bimport\.meta\b|\bnew\s+URL\s*\(|\bexport\s*=|\bexports\b/u;
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
  MENTIONS_AST_ONLY.test(source) ||
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

/** `export default <expression>`, which may hand on anything the file imports. */
const exportsDefaultExpression = (module: ParsedModule["module"]): boolean =>
  module.staticExports.some(({ entries }) =>
    entries.some(
      ({ moduleRequest, localName, exportName }) =>
        moduleRequest === null &&
        localName.kind === "None" &&
        exportName.kind === "Default",
    ),
  );

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
    : { specifiers: [], computed: false, assignsExports: false };
  const imports = unique([
    ...staticImports.map(({ moduleRequest }) => moduleRequest.value),
    ...dynamic.filter((specifier) => specifier !== undefined),
    ...fromAst.specifiers,
  ]);
  const reexports = unique([
    ...staticExports.flatMap(({ entries }) =>
      entries.flatMap(({ moduleRequest }) =>
        moduleRequest === null ? [] : [moduleRequest.value],
      ),
    ),
    ...reexportedBindings(parsed.module),
  ]);
  const handsOnEverything =
    fromAst.assignsExports || exportsDefaultExpression(parsed.module);
  return {
    imports,
    reexports: handsOnEverything ? imports : reexports,
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
 * `import(name)`, `` import(`./${name}`) ``, `require(name)`, `import.meta.glob()`,
 * or `require.context()`.
 *
 * A file re-exports a module when it says `export … from`, exports a binding
 * it imported (`import a from "x"; export default a;`), or exports something
 * it computes: after `export default <expression>`, `module.exports = …`,
 * `exports.x = …`, or `export = …`, everything the file imports counts as
 * re-exported, since any of it may be what the file hands on.
 */
export const typescriptAdapter = (parse: ParseModule): LanguageAdapter => ({
  extensions: EXTENSIONS,
  imports: (file, source) => readImports(parse, file, source),
  canReexport: (source) =>
    MENTIONS_EXPORT.test(source) && MENTIONS_SOURCE.test(source),
});
