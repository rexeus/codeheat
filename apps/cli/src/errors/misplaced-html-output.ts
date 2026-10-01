import { Schema } from "effect";

/** `--html` came with a `.html` path argument that was most likely meant for `--out`. */
export class MisplacedHtmlOutput extends Schema.TaggedError<MisplacedHtmlOutput>()(
  "MisplacedHtmlOutput",
  { path: Schema.String },
) {}
