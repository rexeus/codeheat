// Tests only: a territory record with every field at its neutral value.
import type { Territory } from "../model/territory.js";

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
  changes: 0,
  heatShare: 0,
  description: id,
  splitReason: null,
  fit: null,
});

/** A fit with no evidence at all; override what a test is about. */
export const fitRecord = (
  overrides: Partial<NonNullable<Territory["fit"]>> = {},
): NonNullable<Territory["fit"]> => ({
  detail: 1,
  containment: null,
  radius: null,
  partner: null,
  distantPairs: 0,
  hiddenPairs: 0,
  cliques: 0,
  erosion: null,
  chronicFiles: 0,
  acuteFiles: 0,
  chronicShare: 0,
  fixDensity: null,
  ...overrides,
});
