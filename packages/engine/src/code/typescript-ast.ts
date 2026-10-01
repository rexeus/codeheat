// Owns the part of reading TypeScript and JavaScript imports that the parser's
// module record does not cover: module names that only show in the AST.
import { Predicate } from "effect";

import {
  isImportMeta,
  isMember,
  isNamed,
  isUrlOfImportMeta,
  plainString,
  requiredModule,
  walk,
} from "./ast-nodes.js";
import type { Node } from "./ast-nodes.js";
import { handedOn } from "./typescript-exports.js";

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
  /** The specifiers among all of the file's whose modules the file exports, see `handedOn`. */
  readonly handedOn: ReadonlyArray<string>;
};

/** What one AST node says about a module: it names it, or it loads some by expression. */
type Finding = { readonly specifier: string } | { readonly computed: true };

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

/** `module.exports = …`, `exports.x = …`, or `module.exports.x = …`. */
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

const findingOf = (node: Node): Finding | undefined => {
  const args = node["arguments"];
  const first: unknown = Array.isArray(args) ? args[0] : undefined;
  const reference = node["moduleReference"];
  if (node["type"] === "CallExpression") {
    if (isBundlerLoader(node["callee"])) {
      return { computed: true };
    }
    return isNamed(node["callee"], "Identifier", "require")
      ? moduleFinding(requiredModule(node))
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
  return node["type"] === "TSImportType"
    ? moduleFinding(plainString(node["source"]))
    : undefined;
};

/**
 * Walks `program` (an ESTree AST) for the modules it names outside the module
 * record, and for the imports it hands on (see `handedOn`). `imported` maps
 * the local names of the file's static imports to their specifiers.
 */
export const modulesInAst = (
  program: unknown,
  imported: ReadonlyMap<string, string>,
): AstModules => {
  const specifiers: Array<string> = [];
  const assigned: Array<unknown> = [];
  let computed = false;
  walk(program, (node) => {
    const finding = findingOf(node);
    if (finding !== undefined && "specifier" in finding) {
      specifiers.push(finding.specifier);
    } else if (finding !== undefined) {
      computed = true;
    }
    if (isExportsAssignment(node)) {
      assigned.push(node["right"]);
    }
  });
  const body: unknown = Predicate.isObject(program) ? program["body"] : [];
  return {
    specifiers,
    computed,
    handedOn: handedOn(Array.isArray(body) ? body : [], imported, assigned),
  };
};
