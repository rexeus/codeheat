// Owns the contract-file part of the report contract: what a contract file is,
// how it is recorded, and which contract files were set aside.
// Additive fields keep schemaVersion 1; renaming or removing a field bumps it.
import { Schema } from "effect";

import { Count, UnitInterval } from "./scalars.js";

/** What a universe file is: code is scored, a contract (interface definition or schema) only couples. */
export const FileKind = Schema.Literals(["code", "contract"]);
export type FileKind = typeof FileKind.Type;

/**
 * A contract file: an IDL or schema file (`.tsp`, `.proto`, `.graphql`,
 * `.gql`, `.avsc`, `.thrift`, `.smithy`), a JSON Schema (`*.schema.json`), or
 * an OpenAPI, AsyncAPI, or Swagger description (`openapi.*`, `asyncapi.*`,
 * `swagger.*` in YAML or JSON). It takes part in coupling but has no score,
 * rank, or complexity, and is never listed in `files`.
 */
export const ContractFile = Schema.Struct({
  /** Repository-relative POSIX path. */
  path: Schema.String,
  /**
   * `path` of the module the contract lives in: the nearest module above it,
   * or "." when none is. It counts for the module's cohesion and partners, never
   * for its size.
   */
  module: Schema.String,
  /** Commits of the window that touched the file, large ones included. */
  revisions: Count,
  linesAdded: Count,
  linesDeleted: Count,
});
export type ContractFile = typeof ContractFile.Type;

/** A contract file that changes in so many commits that it says nothing about any one of them. */
export const UbiquitousFile = Schema.Struct({
  path: Schema.String,
  /** Counted commits of the window that touched it (at most `Thresholds.maxCommitFiles` files each). */
  commits: Count,
  /** `commits / window.couplingCommits`, rounded to 4 decimals. */
  share: UnitInterval,
});
export type UbiquitousFile = typeof UbiquitousFile.Type;
