// Owns report v2, the document that answers whether the design holds up to the
// way the code changes.
// Fields may be added within schemaVersion 2, never renamed or removed.
import { Schema } from "effect";

import { Answer } from "./answer.js";
import { Basis } from "./basis.js";
import { Repository, Window } from "./repository.js";

/** What `analyze` reports. */
export const Report = Schema.Struct({
  schemaVersion: Schema.Literal(2),
  repository: Repository,
  window: Window,
  answer: Answer,
  basis: Basis,
});
export type Report = typeof Report.Type;
