import { Schema } from "effect";

/** The treemap file could not be written, e.g. a missing directory or no permission. */
export class HtmlWriteFailed extends Schema.TaggedError<HtmlWriteFailed>()(
  "HtmlWriteFailed",
  { path: Schema.String, reason: Schema.String },
) {}
