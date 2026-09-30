// Owns turning `--since` input into the absolute analysis window.
// @scaffold The resolver lands with step 2.5; only its failure is public now.
import { Schema } from "effect";

/** `since` is neither `<n>d|w|m|y` nor an ISO date (`YYYY-MM-DD`). */
export class InvalidSince extends Schema.TaggedError<InvalidSince>()(
  "InvalidSince",
  { input: Schema.String },
) {}
