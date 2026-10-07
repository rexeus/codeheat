// Owns report v2, the document that answers whether the design holds up to the
// way the code changes, which areas leak, and where the change effort sits.
// Fields may be added within schemaVersion 2, never renamed or removed.
import { Schema } from "effect";

import { Answer } from "./answer.js";
import { Area } from "./area.js";
import { Basis } from "./basis.js";
import { Hotspot } from "./hotspot.js";
import { Repository, Window } from "./repository.js";

/** What `analyze` reports. */
export const Report = Schema.Struct({
  schemaVersion: Schema.Literal(2),
  repository: Repository,
  window: Window,
  answer: Answer,
  /**
   * The judged areas, the areas with at least 1 percent of the heat, and every
   * area the report names elsewhere; the most heat first, ties by path. The
   * other areas are summed up in `basis.rest`.
   */
  areas: Schema.Array(Area),
  /** The ten production files with the most heat, the most first, ties by path. */
  hotspots: Schema.Array(Hotspot),
  basis: Basis,
});
export type Report = typeof Report.Type;
