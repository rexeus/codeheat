// Owns the limits of the entry points, reported under `Report.thresholds` so
// consumers see which gates a finding had to pass.
import type { Report } from "../report/report.js";

/** The limits the entry points read; a subset of `Thresholds`. */
export type EntryLimits = Pick<
  Report["thresholds"],
  | "minEntryHeatShare"
  | "maxEntryContainment"
  | "minEntryChronicShare"
  | "minEntryChanges"
  | "minEntryCouplingChanges"
  | "maxEntriesPerKind"
  | "maxEntries"
>;

export const ENTRY_THRESHOLDS: EntryLimits = {
  minEntryHeatShare: 0.02,
  maxEntryContainment: 0.75,
  minEntryChronicShare: 0.5,
  minEntryChanges: 3,
  minEntryCouplingChanges: 5,
  maxEntriesPerKind: 4,
  maxEntries: 10,
};
