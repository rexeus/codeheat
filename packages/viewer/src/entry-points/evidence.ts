// Owns how the named numbers of an entry point's evidence read: which of them
// a card shows for each kind, in what order, and in which plain words.
import { formatCount, formatShare } from "../render/format.js";

/** One evidence number with the words that say what it counts. */
export type EntryStat = {
  readonly value: string;
  readonly label: string;
};

/** The kinds of weakness an entry point has (`EntryPoint.kind`). */
export type EntryKind =
  | "boundary"
  | "hotspot"
  | "clique"
  | "copies"
  | "hub"
  | "coupling";

type Unit = "share" | "count";

type StatSpec = {
  readonly key: string;
  readonly unit: Unit;
  readonly label: string;
};

/** The numbers of each kind, most telling first; a card shows the first few that the evidence has. */
const SPECS: Record<EntryKind, readonly StatSpec[]> = {
  boundary: [
    { key: "containment", unit: "share", label: "of its changes stay inside" },
    {
      key: "sharedChanges",
      unit: "count",
      label: "changes touched both territories",
    },
    {
      key: "distantPairs",
      unit: "count",
      label: "file pairs across its edge change together",
    },
    {
      key: "hiddenPairs",
      unit: "count",
      label: "of those pairs have no import between them (hidden coupling)",
    },
    { key: "heatShare", unit: "share", label: "of the change effort" },
    { key: "fixShare", unit: "share", label: "of its changes are fixes" },
  ],
  hotspot: [
    {
      key: "chronicHeatShare",
      unit: "share",
      label: "of the change effort is here",
    },
    {
      key: "chronicFiles",
      unit: "count",
      label: "files hot quarter after quarter",
    },
    {
      key: "chronicShare",
      unit: "share",
      label: "of its own effort is chronic",
    },
    { key: "fixShare", unit: "share", label: "of its changes are fixes" },
  ],
  clique: [
    { key: "territories", unit: "count", label: "territories change as one" },
    { key: "heatShare", unit: "share", label: "of the change effort" },
    { key: "weakestShare", unit: "share", label: "tie the weakest pair" },
    { key: "sharedChanges", unit: "count", label: "changes touched all" },
  ],
  copies: [
    { key: "files", unit: "count", label: "copies" },
    { key: "changesToAll", unit: "count", label: "changes touched every copy" },
    { key: "similarity", unit: "share", label: "alike at the least" },
    { key: "heatShare", unit: "share", label: "of the change effort" },
  ],
  hub: [
    { key: "fanIn", unit: "count", label: "files depend on it" },
    {
      key: "changedDependents",
      unit: "count",
      label: "dependents changed with it",
    },
    { key: "changes", unit: "count", label: "changes in the window" },
    { key: "heatShare", unit: "share", label: "of the change effort" },
  ],
  coupling: [
    { key: "sharedChanges", unit: "count", label: "changes touched both" },
    { key: "degree", unit: "share", label: "of the rarer file's changes" },
    { key: "distance", unit: "count", label: "folders apart" },
    { key: "heatShare", unit: "share", label: "of the change effort" },
  ],
};

/** The numbers of `stats` that count something: a count of nothing (`0 file pairs`) says little where there is room for two numbers only. */
export const nonZeroStats = (stats: readonly EntryStat[]): EntryStat[] =>
  stats.filter(({ value }) => value !== "0");

/** What a boundary between two territories says in place of what a boundary of one territory says: their changes, their edges. */
const BETWEEN_LABELS: Readonly<Record<string, string>> = {
  containment: "of their changes stay inside one of the two",
  distantPairs: "file pairs across their edges change together",
  fixShare: "of their changes are fixes",
};

/** The most numbers a card shows for one finding. */
const MAX_STATS = 4;

const formatValue = (value: number, unit: Unit): string =>
  unit === "share" ? formatShare(value) : formatCount(value);

/** The numbers of `evidence` worth showing for a finding of `kind`, at most `limit`, in the kind's order; a boundary that counts `sharedChanges` is one between two territories, which speaks of their changes. */
export const statsOf = (
  kind: EntryKind,
  evidence: Readonly<Record<string, number>>,
  limit: number = MAX_STATS,
): EntryStat[] =>
  SPECS[kind]
    .flatMap(({ key, unit, label }) => {
      const value = evidence[key];
      const between =
        kind === "boundary" && evidence["sharedChanges"] !== undefined;
      return value === undefined
        ? []
        : [
            {
              value: formatValue(value, unit),
              label: (between ? BETWEEN_LABELS[key] : undefined) ?? label,
            },
          ];
    })
    .slice(0, limit);
