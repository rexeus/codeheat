// Owns the schema of how two coupled files relate by import, shared by the
// report's couplings and the distant couplings derived from them.
// Additive fields keep schemaVersion 1; renaming or removing a field bumps it.
import { Schema } from "effect";

/**
 * Whether a static import links two files, directly or through the re-exports
 * of the module it imports: `a→b` means `a` imports `b`. `none` is hidden
 * coupling: the files change together without referring to each other, and
 * every module they and their re-exporting barrels load is accounted for (a
 * universe file, a Node built-in, a declared dependency, a workspace package,
 * an asset). Null when the relation is unknown: a file is not TypeScript or
 * JavaScript, does not parse, no parser was available, or an import could not
 * be resolved (tsconfig path aliases, `#` subpath imports, undeclared
 * packages, code outside the universe, modules loaded by an expression).
 * Unknown is not `none`.
 */
export const ImportRelation = Schema.NullOr(
  Schema.Literals(["a→b", "b→a", "both", "none"]),
);
