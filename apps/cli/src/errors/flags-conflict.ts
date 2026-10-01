import { Schema } from "effect";

/** Flags that were given together but exclude each other. */
export class FlagsConflict extends Schema.TaggedError<FlagsConflict>()(
  "FlagsConflict",
  { flags: Schema.Array(Schema.String) },
) {}
