// Owns finding the modules an exported expression refers to: through the name
// of an import it uses, or through a call that loads a module.
import { Predicate } from "effect";

import { isUrlOfImportMeta, plainString, requiredModule } from "./ast-nodes.js";
import type { Node } from "./ast-nodes.js";

/** Nodes whose parts run only when the function is called. */
const FUNCTIONS = new Set([
  "ArrowFunctionExpression",
  "FunctionExpression",
  "FunctionDeclaration",
]);
const CLASSES = new Set(["ClassExpression", "ClassDeclaration"]);

/** Nodes whose `key` is a plain name unless computed. */
const KEYED = new Set([
  "Property",
  "PropertyDefinition",
  "MethodDefinition",
  "TSPropertySignature",
  "TSMethodSignature",
]);
/** Nodes with a part that is always only spelling. */
const SPELLED: ReadonlyMap<string, ReadonlyArray<string>> = new Map([
  ["JSXMemberExpression", ["property"]],
  ["TSQualifiedName", ["right"]],
  ["JSXAttribute", ["name"]],
  ["LabeledStatement", ["label"]],
  ["BreakStatement", ["label"]],
  ["ContinueStatement", ["label"]],
]);

/**
 * The parts of `node` that spell a name without referring to a binding: a plain
 * property key, a member after the dot, a qualified name's right side, a JSX
 * attribute name, a label. Shorthand `{ run }` keeps its value, which does refer.
 */
const spellingOnly = (node: Node): ReadonlyArray<string> => {
  const type = String(node["type"]);
  if (KEYED.has(type)) {
    return node["computed"] === true ? [] : ["key"];
  }
  if (type === "MemberExpression") {
    return node["computed"] === true ? [] : ["property"];
  }
  return SPELLED.get(type) ?? [];
};

/** The module that `node` loads by itself: `import("x")`, `require("x")`, `new URL("x", import.meta.url)`, `import x = require("x")`, `import("x").T`. */
const loadedModule = (node: Node): string | undefined => {
  switch (node["type"]) {
    case "ImportExpression":
      return plainString(node["source"]);
    case "TSExternalModuleReference":
      return plainString(node["expression"]);
    case "TSImportType":
      return plainString(node["source"]);
    case "NewExpression": {
      const args = node["arguments"];
      return isUrlOfImportMeta(node) && Array.isArray(args)
        ? plainString(args[0])
        : undefined;
    }
    default:
      return requiredModule(node);
  }
};

type Pending = { readonly node: unknown; readonly nested: boolean };

/** Whether the children of `node` under `key` only run later: the parts of a function, and the body of a class. */
const runsLater = (node: Node, key: string): boolean =>
  FUNCTIONS.has(String(node["type"])) ||
  (CLASSES.has(String(node["type"])) && key === "body");

/** The modules `node` refers to by itself: what it loads, and the import its name stands for where that name is evaluated with the expression. */
const modulesAt = (
  node: Node,
  nested: boolean,
  locals: ReadonlyMap<string, string>,
): ReadonlyArray<string> => {
  const isName =
    node["type"] === "Identifier" || node["type"] === "JSXIdentifier";
  const named =
    !nested && isName && typeof node["name"] === "string"
      ? locals.get(node["name"])
      : undefined;
  return [loadedModule(node), named].filter((module) => module !== undefined);
};

const childrenOf = (node: Node, nested: boolean): ReadonlyArray<Pending> => {
  const skipped = spellingOnly(node);
  return Object.entries(node)
    .filter(([key]) => !skipped.includes(key))
    .map(([key, child]) => ({
      node: child,
      nested: nested || runsLater(node, key),
    }));
};

/**
 * The modules that `root` refers to, given `locals`, the module each name
 * stands for. A name counts where it references a binding and is evaluated
 * with the expression: not as a plain key, a member after the dot, or an
 * attribute name, and not inside a function or class body, where it is only
 * used when called. A call that loads a module counts wherever it is, so a
 * route table's `() => import("./Page")` hands on `./Page`.
 */
export const moduleReferences = (
  root: unknown,
  locals: ReadonlyMap<string, string>,
): ReadonlyArray<string> => {
  const found = new Set<string>();
  const pending: Array<Pending> = [{ node: root, nested: false }];
  for (let next = pending.pop(); next !== undefined; next = pending.pop()) {
    const { node, nested } = next;
    if (Array.isArray(node)) {
      for (const element of node as ReadonlyArray<unknown>) {
        pending.push({ node: element, nested });
      }
    } else if (Predicate.isObject(node)) {
      for (const module of modulesAt(node, nested, locals)) {
        found.add(module);
      }
      pending.push(...childrenOf(node, nested));
    }
  }
  return [...found];
};
