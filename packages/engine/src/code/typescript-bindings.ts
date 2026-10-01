// Owns what the top-level code of a TypeScript or JavaScript file binds to the
// modules it imports: every top-level name stands for the modules that its
// import, initializer, or declaration refers to when it is evaluated.
import { Predicate } from "effect";

import { plainString } from "./ast-nodes.js";
import type { Node } from "./ast-nodes.js";
import { moduleReferences } from "./typescript-references.js";

/** The modules a name stands for, by name. */
export type Bindings = Map<string, ReadonlyArray<string>>;

export const asList = (value: unknown): ReadonlyArray<unknown> =>
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

/** What a top-level statement declares, exported or not. */
export const declarationOf = (statement: Node): Node =>
  Predicate.isObject(statement["declaration"])
    ? statement["declaration"]
    : statement;

/** The variable declarators of a top-level statement. */
export const declaratorsOf = (statement: Node): ReadonlyArray<Node> => {
  const declaration = declarationOf(statement);
  return declaration["type"] === "VariableDeclaration"
    ? asList(declaration["declarations"]).filter((value) =>
        Predicate.isObject(value),
      )
    : [];
};

/** The `import X = …` a top-level statement holds, exported or not. */
export const importEqualsOf = (statement: Node): Node | undefined => {
  const declaration = declarationOf(statement);
  return declaration["type"] === "TSImportEqualsDeclaration"
    ? declaration
    : undefined;
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

/** The modules `import X = <reference>` binds X to: the required module, or those of the namespace it names. */
const importEqualsModules = (
  reference: unknown,
  bindings: Bindings,
): ReadonlyArray<string> => {
  if (!Predicate.isObject(reference)) {
    return [];
  }
  if (reference["type"] === "TSExternalModuleReference") {
    return [plainString(reference["expression"])].filter(
      (module) => module !== undefined,
    );
  }
  return bindings.get(leftmostName(reference) ?? "") ?? [];
};

const bind = (
  bindings: Bindings,
  names: ReadonlyArray<string>,
  modules: ReadonlyArray<string>,
): void => {
  if (modules.length > 0) {
    for (const name of names) {
      bindings.set(name, modules);
    }
  }
};

/** Binds what `statement` declares: `import X = …`, variables, functions, and classes. */
const bindStatement = (statement: Node, bindings: Bindings): void => {
  const equals = importEqualsOf(statement);
  if (equals !== undefined) {
    bind(
      bindings,
      bindingNames(equals["id"]),
      importEqualsModules(equals["moduleReference"], bindings),
    );
  }
  for (const declarator of declaratorsOf(statement)) {
    bind(
      bindings,
      bindingNames(declarator["id"]),
      moduleReferences(declarator["init"], bindings),
    );
  }
  const declaration = declarationOf(statement);
  if (
    declaration["type"] === "FunctionDeclaration" ||
    declaration["type"] === "ClassDeclaration"
  ) {
    bind(
      bindings,
      bindingNames(declaration["id"]),
      moduleReferences(declaration, bindings),
    );
  }
};

/**
 * What the top-level `body` binds, in order, starting from `imported`, the
 * specifiers by the local names of the static imports. A name stands for the
 * modules its initializer refers to when evaluated: `const helper =
 * require("./h").helper`, `const m = await import("./m")`, `const api = { run }`.
 */
export const topLevelBindings = (
  body: ReadonlyArray<Node>,
  imported: ReadonlyMap<string, string>,
): Bindings => {
  const bindings: Bindings = new Map(
    [...imported].map(([name, module]) => [name, [module]]),
  );
  for (const statement of body) {
    bindStatement(statement, bindings);
  }
  return bindings;
};
