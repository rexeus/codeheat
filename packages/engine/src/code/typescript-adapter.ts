// Owns reading the imports of TypeScript and JavaScript files through a parser
// the caller injects, so the engine itself carries no parser dependency.
import { Predicate } from "effect";

import type { LanguageAdapter, SourceImports } from "./language-adapter.js";

/**
 * The part of the result of oxc-parser's `parseSync` that the adapter reads,
 * written out so the engine needs no parser package. `program` is the ESTree
 * AST, consulted only for `require()` calls.
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

/** oxc-parser's `parseSync`: the file name selects the language and JSX. */
export type ParseModule = (filename: string, source: string) => ParsedModule;

const EXTENSIONS = ["ts", "tsx", "mts", "cts", "js", "jsx", "mjs", "cjs"];
/** Sources without this text have no `require()` call, so their AST stays unread. */
const MENTIONS_REQUIRE = /\brequire\s*\(/u;
/** Sources without `export * from`, `export { … } from`, or their `type` forms have no re-exports and need no parse. */
const MENTIONS_REEXPORT =
  /\bexport\s*(?:type\s+)?(?:\*|\{[^}]*\})(?:\s*as\s+[\w$]+)?\s*from\b/u;
/** A string literal without escapes or template holes. */
const PLAIN_LITERAL = /^(["'`])([^"'`$\\]*)\1$/u;

const stringLiteral = (node: unknown): string | undefined =>
  Predicate.isObject(node) &&
  node["type"] === "Literal" &&
  typeof node["value"] === "string"
    ? node["value"]
    : undefined;

/** The module named by `require("…")` or `import x = require("…")`, if `node` is one. */
const requiredModule = (node: {
  readonly [key: PropertyKey]: unknown;
}): string | undefined => {
  if (node["type"] === "CallExpression") {
    const { callee, arguments: args } = node;
    return Predicate.isObject(callee) &&
      callee["type"] === "Identifier" &&
      callee["name"] === "require" &&
      Array.isArray(args)
      ? stringLiteral(args[0])
      : undefined;
  }
  const reference = node["moduleReference"];
  return node["type"] === "TSImportEqualsDeclaration" &&
    Predicate.isObject(reference) &&
    reference["type"] === "TSExternalModuleReference"
    ? stringLiteral(reference["expression"])
    : undefined;
};

/** Walks the AST for the modules it requires; an explicit stack keeps deep trees off the call stack. */
const requiredModules = (program: unknown): ReadonlyArray<string> => {
  const found: Array<string> = [];
  const pending: Array<unknown> = [program];
  for (let node = pending.pop(); node !== undefined; node = pending.pop()) {
    if (Array.isArray(node)) {
      pending.push(...(node as ReadonlyArray<unknown>));
    } else if (Predicate.isObject(node)) {
      const specifier = requiredModule(node);
      if (specifier !== undefined) {
        found.push(specifier);
      }
      pending.push(...Object.values(node));
    }
  }
  return found;
};

/** The parser reports `export { a, b } from "x"` once per name. */
const unique = (specifiers: ReadonlyArray<string>): ReadonlyArray<string> => [
  ...new Set(specifiers),
];

const sourceImports = (parsed: ParsedModule, source: string): SourceImports => {
  const { staticImports, staticExports, dynamicImports } = parsed.module;
  const dynamic = dynamicImports.flatMap(({ moduleRequest }) => {
    const literal = source.slice(moduleRequest.start, moduleRequest.end).trim();
    const specifier = PLAIN_LITERAL.exec(literal)?.[2];
    return specifier === undefined ? [] : [specifier];
  });
  return {
    imports: unique([
      ...staticImports.map(({ moduleRequest }) => moduleRequest.value),
      ...dynamic,
      ...(MENTIONS_REQUIRE.test(source) ? requiredModules(parsed.program) : []),
    ]),
    reexports: unique(
      staticExports.flatMap(({ entries }) =>
        entries.flatMap(({ moduleRequest }) =>
          moduleRequest === null ? [] : [moduleRequest.value],
        ),
      ),
    ),
  };
};

const readImports = (
  parse: ParseModule,
  file: string,
  source: string,
): SourceImports | undefined => {
  try {
    const parsed = parse(file, source);
    return parsed.errors.length === 0
      ? sourceImports(parsed, source)
      : undefined;
  } catch {
    return undefined;
  }
};

/**
 * Reads TypeScript and JavaScript (`.ts .tsx .mts .cts .js .jsx .mjs .cjs`)
 * with `parse`. Type-only imports count, since the file still depends on the
 * module. A file with syntax errors, or one the parser throws on, is unknown.
 */
export const typescriptAdapter = (parse: ParseModule): LanguageAdapter => ({
  extensions: EXTENSIONS,
  imports: (file, source) => readImports(parse, file, source),
  reexports: (file, source) =>
    MENTIONS_REEXPORT.test(source)
      ? readImports(parse, file, source)?.reexports
      : [],
});
