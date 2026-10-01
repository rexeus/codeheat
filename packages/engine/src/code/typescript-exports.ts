// Owns telling which of the imports of a TypeScript or JavaScript file the
// file hands on to whoever imports it. The same rule serves ES modules and
// CommonJS: an import is handed on when its binding, or the `require()` call
// itself, occurs inside an exported expression (see `moduleReferences` for
// what occurring means). Use inside a function or class is usage, not handing on.
import { Predicate } from "effect";

import { plainString, requiredModule } from "./ast-nodes.js";
import type { Node } from "./ast-nodes.js";
import { moduleReferences } from "./typescript-references.js";

/** An expression that is a function or a class: its body only uses what it names. */
const CALLABLE = new Set([
  "ArrowFunctionExpression",
  "FunctionExpression",
  "FunctionDeclaration",
  "ClassExpression",
  "ClassDeclaration",
  "TSInterfaceDeclaration",
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

/** The `import X = …` a top-level statement holds, exported or not. */
const importEqualsOf = (statement: Node): Node | undefined => {
  const inner = Predicate.isObject(statement["declaration"])
    ? statement["declaration"]
    : statement;
  return inner["type"] === "TSImportEqualsDeclaration" ? inner : undefined;
};

/** The leftmost name of `ns.Y.Z`. */
const leftmostName = (reference: unknown): string | undefined => {
  let node = reference;
  while (Predicate.isObject(node) && node["type"] === "TSQualifiedName") {
    node = node["left"];
  }
  return Predicate.isObject(node) && typeof node["name"] === "string"
    ? node["name"]
    : undefined;
};

/** The module `import X = <reference>` binds X to: the required module, or that of the namespace it names. */
const importEqualsModule = (
  reference: unknown,
  locals: ReadonlyMap<string, string>,
): string | undefined => {
  if (!Predicate.isObject(reference)) {
    return undefined;
  }
  if (reference["type"] === "TSExternalModuleReference") {
    return plainString(reference["expression"]);
  }
  const root = leftmostName(reference);
  return root === undefined ? undefined : locals.get(root);
};

/** Binds the name of `import X = …` to the module it stands for. */
const bindImportEquals = (
  statement: Node,
  locals: Map<string, string>,
): void => {
  const equals = importEqualsOf(statement);
  const module =
    equals === undefined
      ? undefined
      : importEqualsModule(equals["moduleReference"], locals);
  if (module !== undefined) {
    for (const name of bindingNames(equals?.["id"])) {
      locals.set(name, module);
    }
  }
};

/** Records the initializer of each variable `statement` declares, and the module a `const x = require("y")` binds. */
const bindDeclarators = (
  statement: Node,
  locals: Map<string, string>,
  initializers: Map<string, unknown>,
): void => {
  for (const declarator of declarationsOf(statement)) {
    const required = requiredModule(declarator["init"]);
    for (const name of bindingNames(declarator["id"])) {
      initializers.set(name, declarator["init"]);
      if (required !== undefined) {
        locals.set(name, required);
      }
    }
  }
};

/** What the top-level code binds: the initializer of each variable, and the imports each name stands for. */
const topLevelBindings = (
  body: ReadonlyArray<Node>,
  imported: ReadonlyMap<string, string>,
) => {
  const locals = new Map(imported);
  const initializers = new Map<string, unknown>();
  for (const statement of body) {
    bindImportEquals(statement, locals);
    bindDeclarators(statement, locals, initializers);
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
            importEqualsOf(statement)?.["moduleReference"],
            Predicate.isObject(statement["declaration"]) &&
            statement["declaration"]["type"] === "TSTypeAliasDeclaration"
              ? statement["declaration"]["typeAnnotation"]
              : undefined,
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

/**
 * The specifiers of the imports that `body` (the top-level statements of the
 * program) exports: those whose binding, or `require()` call, occurs inside
 *
 * - the initializer of an exported variable,
 * - an `export default <expression>`, `export =`, or `export { name }`,
 * - an exported `import X = …`, or the type of an exported `type U = T`,
 * - the value of `module.exports = …` or `exports.x = …` (`assigned`).
 *
 * A name in such an expression is followed one level, to the initializer of
 * the top-level variable it names (`const api = { run }; export default api`).
 * An expression that is itself a function or class is usage, and so is an
 * interface. `imported` maps the local names of the static imports to their
 * specifiers.
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
      for (const module of moduleReferences(root, locals)) {
        found.add(module);
      }
    }
  }
  return [...found];
};
