// Tests only: a territory record with every field at its neutral value.
import type { Territory } from "../report/territory.js";

/** A territory `id` of `kind` below `parent` (null for the root) that splits into `children`; everything else is neutral. */
export const territoryRecord = (
  id: string,
  kind: Territory["kind"] = "folder",
  parent: string | null = null,
  children: ReadonlyArray<string> = [],
): Territory => ({
  id,
  path: id,
  kind,
  parent,
  children,
  files: 1,
  testFiles: 0,
  changes: 0,
  heatShare: 0,
  description: id,
  splitReason: null,
  fit: null,
});
