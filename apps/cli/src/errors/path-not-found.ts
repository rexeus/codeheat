import { Schema } from "effect";

/** The `analyze` path argument names nothing on disk. */
export class PathNotFound extends Schema.TaggedError<PathNotFound>()(
  "PathNotFound",
  { path: Schema.String },
) {}
