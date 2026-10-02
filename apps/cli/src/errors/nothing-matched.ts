import { Schema } from "effect";

/**
 * `inspect` was given patterns and none of them matched a code file: they
 * matched nothing (`patterns`) or only contract files (`contracts`), which
 * have no entry to show.
 */
export class NothingMatched extends Schema.TaggedError<NothingMatched>()(
  "NothingMatched",
  {
    patterns: Schema.Array(Schema.String),
    contracts: Schema.Array(Schema.String),
  },
) {}

/** The words for a contract file that `inspect` was asked about; callers escape the result. */
export const contractFileMessage = (path: string): string =>
  `"${path}" is a contract file; inspect the code that changes with it`;
