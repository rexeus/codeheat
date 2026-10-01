// Owns telling which of the imports of a TypeScript or JavaScript file the
// file hands on to whoever imports it. The same rule serves ES modules and
// CommonJS: an import is handed on when its binding, or the `require()` call
// itself, occurs inside an exported expression. Use inside the body of an
// exported function or class is usage, not handing on.
import { Predicate } from "effect";

import { plainString, requiredModule, walk } from "./ast-nodes.js";
import type { Node } from "./ast-nodes.js";

/** An expression that is a function or a class: its body only uses what it names. */
const CALLABLE = new Set([
  "ArrowFunctionExpression",
  "FunctionExpression",
  "FunctionDeclaration",
  "ClassExpression",
  "ClassDeclaration",
  "TSInterfaceDeclaration",
  "TSTypeAliasDeclaration",
  "TSEnumDeclaration",
  "TSModuleDeclaration",
]);

const asList = (value: unknown): ReadonlyArray<unknown> =>
  Array.isArray(value) ? (value as ReadonlyArray<unknown>) : [];

/** The names a binding pattern declares: `a`, `{ a, b: c }`, `[a, ...b]`. */
const bindingNames = (pattern: unknown): ReadonlyArray<string> => {
  if (!Predicate.isObject(pattern)) {
    return [];
  }
  switch (pattern["type"]) {
    case "Identifier":
      return typeof pattern["name"] === "string" ? [pattern["name"]] : [];
    case "ObjectPattern":
      return asList(pattern["properties"]).flatMap((property) =>
        bindingNames(
          Predicate.isObject(property) && property["type"] === "Property"
            ? property["value"]
            : property,
        ),
      );
    case "ArrayPattern":
      return asList(pattern["elements"]).flatMap((element) =>
        bindingNames(element),
      );
    case "RestElement":
      return bindingNames(pattern["argument"]);
    case "AssignmentPattern":
      return bindingNames(pattern["left"]);
    default:
      return [];
  }
};

/** The variable declaration a top-level statement holds, exported or not. */
const declarationsOf = (statement: Node): ReadonlyArray<Node> => {
  const declaration = Predicate.isObject(statement["declaration"])
    ? statement["declaration"]
    : statement;
  return declaration["type"] === "VariableDeclaration"
    ? asList(declaration["declarations"]).filter((value) =>
        Predicate.isObject(value),
      )
    : [];
};

/** The module a top-level statement binds names to, and those names: `const a = require("x")`, `import a = require("x")`. */
const requireBindings = (
  statement: Node,
): ReadonlyArray<{ readonly name: string; readonly module: string }> => {
  const reference = statement["moduleReference"];
  const fromEquals =
    statement["type"] === "TSImportEqualsDeclaration" &&
    Predicate.isObject(reference)
      ? [
          {
            pattern: statement["id"],
            module: plainString(reference["expression"]),
          },
        ]
      : [];
  const fromDeclarators = declarationsOf(statement).map((declarator) => ({
    pattern: declarator["id"],
    module: requiredModule(declarator["init"]),
  }));
  return [...fromEquals, ...fromDeclarators].flatMap(({ pattern, module }) =>
    module === undefined
      ? []
      : bindingNames(pattern).map((name) => ({ name, module })),
  );
};

/** What the top-level code binds: the initializer of each variable, and the imports each name stands for. */
const topLevelBindings = (
  body: ReadonlyArray<Node>,
  imported: ReadonlyMap<string, string>,
) => {
  const locals = new Map(imported);
  const initializers = new Map<string, unknown>();
  for (const statement of body) {
    for (const { name, module } of requireBindings(statement)) {
      locals.set(name, module);
    }
    for (const declarator of declarationsOf(statement)) {
      for (const name of bindingNames(declarator["id"])) {
        initializers.set(name, declarator["init"]);
      }
    }
  }
  return { locals, initializers };
};

/** The expressions a top-level statement exports, before a name is followed to its initializer. */
const exportedExpressions = (statement: Node): ReadonlyArray<unknown> => {
  switch (statement["type"]) {
    case "ExportNamedDeclaration":
      return statement["source"] === null || statement["source"] === undefined
        ? [
            ...declarationsOf(statement).map(({ init }) => init),
            ...asList(statement["specifiers"]).map((specifier) =>
              Predicate.isObject(specifier) ? specifier["local"] : undefined,
            ),
          ]
        : [];
    case "ExportDefaultDeclaration":
      return [statement["declaration"]];
    case "TSExportAssignment":
      return [statement["expression"]];
    default:
      return [];
  }
};

/** The module that `node` refers to when it is a name bound by an import, a `require()` call, or a dynamic `import("x")`. */
const moduleAt = (
  node: Node,
  locals: ReadonlyMap<string, string>,
): string | undefined => {
  if (node["type"] === "Identifier" || node["type"] === "JSXIdentifier") {
    return typeof node["name"] === "string"
      ? locals.get(node["name"])
      : undefined;
  }
  return node["type"] === "ImportExpression"
    ? plainString(node["source"])
    : requiredModule(node);
};

/**
 * The specifiers of the imports that `body` (the top-level statements of the
 * program) exports: those whose binding, or `require()` call, occurs inside
 *
 * - the initializer of an exported variable,
 * - an `export default <expression>`, `export =`, or `export { name }`,
 * - the value of `module.exports = …` or `exports.x = …` (`assigned`).
 *
 * A name in such an expression is followed one level, to the initializer of
 * the top-level variable it names (`const api = { run }; export default api`).
 * An expression that is itself a function or class is usage. `imported` maps
 * the local names of the static imports to their specifiers.
 */
export const handedOn = (
  body: ReadonlyArray<unknown>,
  imported: ReadonlyMap<string, string>,
  assigned: ReadonlyArray<unknown>,
): ReadonlyArray<string> => {
  const statements = body.filter((value) => Predicate.isObject(value));
  const { locals, initializers } = topLevelBindings(statements, imported);
  const roots = [
    ...statements.flatMap((statement) => exportedExpressions(statement)),
    ...assigned,
  ].flatMap((root) =>
    Predicate.isObject(root) && root["type"] === "Identifier"
      ? [root, initializers.get(String(root["name"]))]
      : [root],
  );
  const found = new Set<string>();
  for (const root of roots) {
    if (Predicate.isObject(root) && !CALLABLE.has(String(root["type"]))) {
      walk(root, (node) => {
        const module = moduleAt(node, locals);
        if (module !== undefined) {
          found.add(module);
        }
      });
    }
  }
  return [...found];
};
