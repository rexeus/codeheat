// Owns the small vocabulary for reading an ESTree AST that arrives as untrusted
// data: guards for node shapes and a walk that cannot overflow the call stack.
import { Predicate } from "effect";

export type Node = { readonly [key: PropertyKey]: unknown };

/** The text of a string literal or of a template literal without holes. */
export const plainString = (node: unknown): string | undefined => {
  if (!Predicate.isObject(node)) {
    return undefined;
  }
  if (node["type"] === "Literal" && typeof node["value"] === "string") {
    return node["value"];
  }
  const { quasis, expressions } = node;
  const first: unknown = Array.isArray(quasis) ? quasis[0] : undefined;
  if (
    node["type"] !== "TemplateLiteral" ||
    !Array.isArray(expressions) ||
    expressions.length > 0 ||
    !Predicate.isObject(first) ||
    !Predicate.isObject(first["value"])
  ) {
    return undefined;
  }
  const cooked = first["value"]["cooked"];
  return typeof cooked === "string" ? cooked : undefined;
};

export const isNamed = (node: unknown, type: string, name: string): boolean =>
  Predicate.isObject(node) && node["type"] === type && node["name"] === name;

export const isMember = (
  node: unknown,
  object: string,
  property: string,
): boolean =>
  Predicate.isObject(node) &&
  node["type"] === "MemberExpression" &&
  isNamed(node["object"], "Identifier", object) &&
  isNamed(node["property"], "Identifier", property);

/** The module of `require("x")`, undefined for any other node or a `require` of something else than a plain string. */
export const requiredModule = (node: unknown): string | undefined => {
  if (
    !Predicate.isObject(node) ||
    node["type"] !== "CallExpression" ||
    !isNamed(node["callee"], "Identifier", "require")
  ) {
    return undefined;
  }
  const args = node["arguments"];
  return Array.isArray(args) ? plainString(args[0]) : undefined;
};

/** `import.meta`, which the AST shows as a meta property. */
export const isImportMeta = (node: unknown): boolean =>
  Predicate.isObject(node) &&
  node["type"] === "MetaProperty" &&
  isNamed(node["meta"], "Identifier", "import");

/** `new URL("./worker.ts", import.meta.url)`, which bundlers turn into a reference to that file. */
export const isUrlOfImportMeta = (node: Node): boolean => {
  const args = node["arguments"];
  return (
    node["type"] === "NewExpression" &&
    isNamed(node["callee"], "Identifier", "URL") &&
    Array.isArray(args) &&
    Predicate.isObject(args[1]) &&
    args[1]["type"] === "MemberExpression" &&
    isImportMeta(args[1]["object"])
  );
};

/**
 * Calls `visit` for every node below and including `root`. An explicit stack
 * keeps deep trees and arrays of any width off the call stack.
 */
export const walk = (root: unknown, visit: (node: Node) => void): void => {
  const pending: Array<unknown> = [root];
  for (let node = pending.pop(); node !== undefined; node = pending.pop()) {
    if (Array.isArray(node)) {
      for (const element of node as ReadonlyArray<unknown>) {
        pending.push(element);
      }
    } else if (Predicate.isObject(node)) {
      visit(node);
      for (const child of Object.values(node)) {
        pending.push(child);
      }
    }
  }
};
