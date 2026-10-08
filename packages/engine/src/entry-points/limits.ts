// Owns the limits of the entry points, reported under `Analysis.thresholds` so
// consumers see which gates a finding had to pass.
import type { Analysis } from "../model/analysis.js";

/** The limits the entry points read; a subset of `Thresholds`. */
export type EntryLimits = Pick<
  Analysis["thresholds"],
  | "minEntryHeatShare"
  | "maxEntryContainment"
  | "minEntryChronicShare"
  | "minEntryChanges"
  | "minEntryCouplingChanges"
  | "minEntryScore"
  | "maxEntriesPerKind"
  | "maxEntries"
>;

export const ENTRY_THRESHOLDS: EntryLimits = {
  minEntryHeatShare: 0.02,
  maxEntryContainment: 0.75,
  minEntryChronicShare: 0.5,
  minEntryChanges: 3,
  minEntryCouplingChanges: 5,
  minEntryScore: 0.005,
  maxEntriesPerKind: 6,
  maxEntries: 10,
};
