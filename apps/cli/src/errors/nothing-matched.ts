import { Schema } from "effect";

/** `inspect` was given patterns and none of them matched a universe file. */
export class NothingMatched extends Schema.TaggedError<NothingMatched>()(
  "NothingMatched",
  { patterns: Schema.Array(Schema.String) },
) {}
