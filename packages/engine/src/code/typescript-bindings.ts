// Owns what the top-level code of a TypeScript or JavaScript file binds to the
// modules it imports: every top-level name stands for the modules that its
// import, initializer, or declaration refers to when it is evaluated.
import { Predicate } from "effect";

import { plainString, walk } from "./ast-nodes.js";
import type { Node } from "./ast-nodes.js";
import { moduleReferences } from "./typescript-references.js";

/** The modules a name stands for, by name. */
export type Bindings = Map<string, Set<string>>;

export const asList = (value: unknown): ReadonlyArray<unknown> =>
  Array.isArray(value) ? (value as ReadonlyArray<unknown>) : [];

/** The names a binding pattern declares: `a`, `{ a, b: c }`, `[a, ...b]`. */
export const bindingNames = (pattern: unknown): ReadonlyArray<string> => {
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
  return [...(bindings.get(leftmostName(reference) ?? "") ?? [])];
};

/** Adds `modules` to what each of `names` stands for. */
const bind = (
  bindings: Bindings,
  names: ReadonlyArray<string>,
  modules: ReadonlyArray<string>,
): void => {
  for (const name of names) {
    const known = bindings.get(name) ?? new Set<string>();
    for (const module of modules) {
      known.add(module);
    }
    if (known.size > 0) {
      bindings.set(name, known);
    }
  }
};

/** Nodes whose inside runs later, or not at the top level, so assignments in it are not the file's own. */
const NOT_TOP_LEVEL = new Set([
  "ArrowFunctionExpression",
  "FunctionExpression",
  "FunctionDeclaration",
  "ClassExpression",
  "ClassDeclaration",
]);

const WRAPPERS = new Set([
  "ParenthesizedExpression",
  "TSAsExpression",
  "TSNonNullExpression",
  "TSTypeAssertion",
  "TSSatisfiesExpression",
]);

/** The top-level names an assignment target is rooted at: `n` in `n = …`, `n.a.b = …`, `(n as T).a = …`, and every one in `{ a, b: n.c } = …` and `[a, ...b] = …`. */
const targetNames = (target: unknown): ReadonlyArray<string> => {
  let node = target;
  while (
    Predicate.isObject(node) &&
    (WRAPPERS.has(String(node["type"])) || node["type"] === "MemberExpression")
  ) {
    node =
      node["type"] === "MemberExpression" ? node["object"] : node["expression"];
  }
  if (!Predicate.isObject(node)) {
    return [];
  }
  switch (node["type"]) {
    case "Identifier":
      return typeof node["name"] === "string" ? [node["name"]] : [];
    case "ObjectPattern":
      return asList(node["properties"]).flatMap((property) =>
        targetNames(
          Predicate.isObject(property) && property["type"] === "Property"
            ? property["value"]
            : property,
        ),
      );
    case "ArrayPattern":
      return asList(node["elements"]).flatMap((element) =>
        targetNames(element),
      );
    case "RestElement":
      return targetNames(node["argument"]);
    case "AssignmentPattern":
      return targetNames(node["left"]);
    default:
      return [];
  }
};

/** Merges what the assignments in `statement` (not in functions or classes) give to top-level names. */
const bindAssignments = (statement: Node, bindings: Bindings): void => {
  walk(
    statement,
    (node) => {
      if (node["type"] === "AssignmentExpression") {
        bind(
          bindings,
          targetNames(node["left"]),
          moduleReferences(node["right"], bindings),
        );
      }
    },
    (node) => !NOT_TOP_LEVEL.has(String(node["type"])),
  );
};

/** Binds the functions first: a function declaration is hoisted, so code above it can name it. */
const hoistFunctions = (
  body: ReadonlyArray<Node>,
  bindings: Bindings,
): void => {
  for (const statement of body) {
    const declaration = declarationOf(statement);
    if (declaration["type"] === "FunctionDeclaration") {
      bind(
        bindings,
        bindingNames(declaration["id"]),
        moduleReferences(declaration, bindings),
      );
    }
  }
};

/** Binds what `statement` declares: `import X = …`, variables, and classes; functions are bound before. */
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
  if (declaration["type"] === "ClassDeclaration") {
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
 * require("./h").helper`, `const m = await import("./m")`, `const api = { run }`,
 * plus what is assigned to it or to a member of it at the top level, also
 * inside `if`, `try`, and blocks: `Form.Item = Item`, `impl = require("./t")`.
 */
export const topLevelBindings = (
  body: ReadonlyArray<Node>,
  imported: ReadonlyMap<string, string>,
): Bindings => {
  const bindings: Bindings = new Map(
    [...imported].map(([name, module]) => [name, new Set([module])]),
  );
  hoistFunctions(body, bindings);
  for (const statement of body) {
    bindStatement(statement, bindings);
    bindAssignments(statement, bindings);
  }
  return bindings;
};
