// Owns the part of reading TypeScript and JavaScript imports that the parser's
// module record does not cover: module names that only show in the AST.
import { Predicate } from "effect";

/** Modules the AST names beyond the module record. */
export type AstModules = {
  /** `require("x")`, `import x = require("x")`, and the `import("x")` of a type such as `import("x").T`. */
  readonly specifiers: ReadonlyArray<string>;
  /** A `require()` whose argument is not a plain string, so the module it loads is unknown. */
  readonly computed: boolean;
};

type Node = { readonly [key: PropertyKey]: unknown };

/** The text of a string literal or of a template literal without holes. */
const plainString = (node: unknown): string | undefined => {
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

const isRequireCall = (node: Node): boolean => {
  const { callee } = node;
  return (
    node["type"] === "CallExpression" &&
    Predicate.isObject(callee) &&
    callee["type"] === "Identifier" &&
    callee["name"] === "require"
  );
};

/** The module `node` names: its specifier, null when it is not a plain string, undefined when `node` names no module. */
const moduleOf = (node: Node): string | null | undefined => {
  if (isRequireCall(node)) {
    const args = node["arguments"];
    return (Array.isArray(args) ? plainString(args[0]) : undefined) ?? null;
  }
  const reference = node["moduleReference"];
  if (
    node["type"] === "TSImportEqualsDeclaration" &&
    Predicate.isObject(reference) &&
    reference["type"] === "TSExternalModuleReference"
  ) {
    return plainString(reference["expression"]) ?? null;
  }
  return node["type"] === "TSImportType"
    ? (plainString(node["source"]) ?? null)
    : undefined;
};

/**
 * Walks `program` (an ESTree AST) for the modules it names outside the module
 * record. An explicit stack keeps deep trees off the call stack.
 */
export const modulesInAst = (program: unknown): AstModules => {
  const specifiers: Array<string> = [];
  let computed = false;
  const pending: Array<unknown> = [program];
  for (let node = pending.pop(); node !== undefined; node = pending.pop()) {
    if (Array.isArray(node)) {
      pending.push(...(node as ReadonlyArray<unknown>));
    } else if (Predicate.isObject(node)) {
      const named = moduleOf(node);
      if (named === null) {
        computed = true;
      } else if (named !== undefined) {
        specifiers.push(named);
      }
      pending.push(...Object.values(node));
    }
  }
  return { specifiers, computed };
};
