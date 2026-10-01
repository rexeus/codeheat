// Owns telling which of the imports of a TypeScript or JavaScript file the
// file hands on to whoever imports it. The same rule serves ES modules and
// CommonJS: an import is handed on when its binding, or the call that loads
// it, occurs inside an exported expression (see `moduleReferences` for what
// occurring means). Use inside the body of a function or class is usage.
import { Predicate } from "effect";

import type { Node } from "./ast-nodes.js";
import {
  asList,
  bindingNames,
  declarationOf,
  declaratorsOf,
  importEqualsOf,
  topLevelBindings,
} from "./typescript-bindings.js";
import { moduleReferences } from "./typescript-references.js";

/** Declarations that export no value: they are usage of what they name, not handing on. */
const NOT_VALUES = new Set([
  "TSInterfaceDeclaration",
  "TSEnumDeclaration",
  "TSModuleDeclaration",
]);

/** The expression an exported type alias is, and the type parameters whose constraints and defaults it carries. */
const typeAliasParts = (declaration: Node): ReadonlyArray<unknown> =>
  declaration["type"] === "TSTypeAliasDeclaration"
    ? [declaration["typeAnnotation"], declaration["typeParameters"]]
    : [];

/** A bare reference to `name`, which stands for what the name was bound to, assignments after the declaration included. */
const nameNode = (name: string): Node => ({ type: "Identifier", name });

/** The expressions a top-level statement exports. */
const exportedExpressions = (statement: Node): ReadonlyArray<unknown> => {
  switch (statement["type"]) {
    case "ExportNamedDeclaration": {
      if (statement["source"] !== null && statement["source"] !== undefined) {
        return [];
      }
      const declaration = declarationOf(statement);
      return [
        ...declaratorsOf(statement).flatMap(({ init, id }) =>
          [init].concat(bindingNames(id).map((name) => nameNode(name))),
        ),
        importEqualsOf(statement)?.["moduleReference"],
        ...typeAliasParts(declaration),
        declaration["type"] === "FunctionDeclaration" ||
        declaration["type"] === "ClassDeclaration"
          ? declaration
          : undefined,
        ...asList(statement["specifiers"]).map((specifier) =>
          Predicate.isObject(specifier) ? specifier["local"] : undefined,
        ),
      ];
    }
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
 * program) exports: those whose binding, or loading call, occurs inside
 *
 * - the initializer, and later assignments, of an exported variable, an exported function or class,
 * - an `export default <expression>`, `export =`, or `export { name }`,
 * - an exported `import X = …`, or an exported `type U<…> = T`,
 * - the value of `module.exports = …` or `exports.x = …` (`assigned`).
 *
 * A top-level name stands for the modules its own initializer or declaration
 * refers to (see `topLevelBindings`), so `const api = { run }; export default
 * api` hands on what `run` was imported from. A function or class contributes
 * only what it loads wherever it is, and its heritage (`extends Base`). An
 * interface is usage. `imported` maps the local names of the static imports to
 * their specifiers.
 */
export const handedOn = (
  body: ReadonlyArray<unknown>,
  imported: ReadonlyMap<string, string>,
  assigned: ReadonlyArray<unknown>,
): ReadonlyArray<string> => {
  const statements = body.filter((value) => Predicate.isObject(value));
  const bindings = topLevelBindings(statements, imported);
  const roots = [
    ...statements.flatMap((statement) => exportedExpressions(statement)),
    ...assigned,
  ];
  const found = new Set<string>();
  for (const root of roots) {
    if (Predicate.isObject(root) && !NOT_VALUES.has(String(root["type"]))) {
      for (const module of moduleReferences(root, bindings)) {
        found.add(module);
      }
    }
  }
  return [...found];
};
