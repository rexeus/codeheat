// Owns the part of reading TypeScript and JavaScript imports that the parser's
// module record does not cover: module names that only show in the AST.
import { Predicate } from "effect";

/** Modules the AST names beyond the module record. */
export type AstModules = {
  /**
   * `require("x")`, `import x = require("x")`, the `import("x")` of a type such
   * as `import("x").T`, and the file of `new URL("./x", import.meta.url)`.
   */
  readonly specifiers: ReadonlyArray<string>;
  /**
   * The file loads modules the specifiers do not name: a `require()` or
   * `new URL()` whose argument is not a plain string, `import.meta.glob()`,
   * or `require.context()`.
   */
  readonly computed: boolean;
  /**
   * The file assigns what it exports outside `export` statements:
   * `module.exports = …`, `exports.x = …`, or `export = …`. What the file
   * requires may be what it exports.
   */
  readonly assignsExports: boolean;
};

type Node = { readonly [key: PropertyKey]: unknown };

/** What one AST node says: a module it names, that it loads some by expression, or that it assigns exports. */
type Finding =
  | { readonly specifier: string }
  | { readonly computed: true }
  | { readonly assignsExports: true };

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

const isNamed = (node: unknown, type: string, name: string): boolean =>
  Predicate.isObject(node) && node["type"] === type && node["name"] === name;

const isMember = (node: unknown, object: string, property: string): boolean =>
  Predicate.isObject(node) &&
  node["type"] === "MemberExpression" &&
  isNamed(node["object"], "Identifier", object) &&
  isNamed(node["property"], "Identifier", property);

/** `import.meta`, which the AST shows as a meta property. */
const isImportMeta = (node: unknown): boolean =>
  Predicate.isObject(node) &&
  node["type"] === "MetaProperty" &&
  isNamed(node["meta"], "Identifier", "import");

/** `import.meta.glob` and its relatives, `require.context`: they load whole sets of modules. */
const isBundlerLoader = (callee: unknown): boolean =>
  isMember(callee, "require", "context") ||
  (Predicate.isObject(callee) &&
    callee["type"] === "MemberExpression" &&
    isImportMeta(callee["object"]) &&
    Predicate.isObject(callee["property"]) &&
    String(callee["property"]["name"]).startsWith("glob"));

/** `module.exports` or `exports`. */
const isExportsObject = (node: unknown): boolean =>
  isNamed(node, "Identifier", "exports") || isMember(node, "module", "exports");

const isExportsAssignment = (node: Node): boolean => {
  const target = node["left"];
  return (
    node["type"] === "AssignmentExpression" &&
    (isExportsObject(target) ||
      (Predicate.isObject(target) &&
        target["type"] === "MemberExpression" &&
        isExportsObject(target["object"])))
  );
};

const moduleFinding = (module: string | undefined): Finding =>
  module === undefined ? { computed: true } : { specifier: module };

/** `new URL("./worker.ts", import.meta.url)`, which bundlers turn into a reference to that file. */
const isUrlOfImportMeta = (node: Node): boolean => {
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

const findingOf = (node: Node): Finding | undefined => {
  const args = node["arguments"];
  const first: unknown = Array.isArray(args) ? args[0] : undefined;
  const reference = node["moduleReference"];
  if (node["type"] === "CallExpression") {
    if (isBundlerLoader(node["callee"])) {
      return { computed: true };
    }
    return isNamed(node["callee"], "Identifier", "require")
      ? moduleFinding(plainString(first))
      : undefined;
  }
  if (isUrlOfImportMeta(node)) {
    return moduleFinding(plainString(first));
  }
  if (
    node["type"] === "TSImportEqualsDeclaration" &&
    Predicate.isObject(reference) &&
    reference["type"] === "TSExternalModuleReference"
  ) {
    return moduleFinding(plainString(reference["expression"]));
  }
  if (node["type"] === "TSImportType") {
    return moduleFinding(plainString(node["source"]));
  }
  return node["type"] === "TSExportAssignment" || isExportsAssignment(node)
    ? { assignsExports: true }
    : undefined;
};

/**
 * Walks `program` (an ESTree AST) for the modules it names outside the module
 * record. An explicit stack keeps deep trees off the call stack.
 */
export const modulesInAst = (program: unknown): AstModules => {
  const specifiers: Array<string> = [];
  let computed = false;
  let assignsExports = false;
  const pending: Array<unknown> = [program];
  for (let node = pending.pop(); node !== undefined; node = pending.pop()) {
    if (Array.isArray(node)) {
      pending.push(...(node as ReadonlyArray<unknown>));
    } else if (Predicate.isObject(node)) {
      const finding = findingOf(node);
      if (finding !== undefined && "specifier" in finding) {
        specifiers.push(finding.specifier);
      } else if (finding !== undefined && "computed" in finding) {
        computed = true;
      } else if (finding !== undefined) {
        assignsExports = true;
      }
      pending.push(...Object.values(node));
    }
  }
  return { specifiers, computed, assignsExports };
};
