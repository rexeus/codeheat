// Owns what a place to start says on the page: the engine's entry points
// (rank, kind, verdict, design move, evidence) turned into a short name, the
// change effort at stake, and the numbers to show in plain words.
import type { FileStats, Analysis } from "@codeheat/engine";

import { distinctNameParts } from "../territories/distinct-names.js";
import { territoryName } from "../territories/territory-index.js";
import type {
  Territory,
  TerritoryIndex,
} from "../territories/territory-index.js";
import { statsOf } from "./evidence.js";
import type { EntryKind, EntryStat } from "./evidence.js";
import { subjectOf } from "./subject.js";

type EntryPoint = Analysis["entryPoints"][number];

const KIND_LABELS: Record<EntryKind, string> = {
  boundary: "Boundary",
  hotspot: "Hotspot",
  clique: "Clique",
  copies: "Copies",
  hub: "Hub",
  coupling: "Hidden coupling",
};

/** How many places to start the answer sums up as the top ones. */
export const TOP_ENTRY_POINTS = 3;

/** What the page shows for one entry point. */
export type EntryView = {
  readonly rank: number;
  readonly kind: EntryKind;
  readonly kindLabel: string;
  /** A short name: the territories that tell themselves apart (`a + b` for a boundary between two), or the files a file-level entry names. */
  readonly name: string;
  /** The full paths behind `name`, for a tooltip. */
  readonly title: string;
  /** The share of all the heat at stake, by its kind's evidence, 0..1. */
  readonly heatShare: number;
  readonly verdict: string;
  /** The verb phrase of the design move (`Move a boundary`); the kind's label when the move has none. */
  readonly moveLabel: string;
  /** The design move without its verb phrase. */
  readonly move: string;
  readonly stats: readonly EntryStat[];
};

/** A file name or path: a word with a slash, or a name with an extension. */
const PATH_START = /^(?:\S*\/\S*|[\w@-]+(?:\.[\w-]+)+)(?=\s|$)/u;

/** The text with its first letter in upper case, unless it starts with a path, which is case sensitive. */
const capitalized = (text: string): string =>
  PATH_START.test(text) ? text : text.slice(0, 1).toUpperCase() + text.slice(1);

/** Splits `Move a boundary: bring what …` into its verb phrase and the rest. */
const splitMove = (designMove: string): { label: string; rest: string } => {
  const cut = designMove.indexOf(": ");
  return cut === -1
    ? { label: "", rest: designMove }
    : {
        label: designMove.slice(0, cut),
        rest: capitalized(designMove.slice(cut + 2)),
      };
};

/** The territories of an entry at the recommended detail, each once. */
const territoriesOf = (
  ids: readonly string[],
  index: TerritoryIndex,
): Territory[] => [
  ...new Map(
    ids.flatMap((id) => {
      const visible = index.visibleOf(id);
      return visible === undefined ? [] : [[visible.id, visible] as const];
    }),
  ).values(),
];

/**
 * The evidence that says how much of the heat an entry of
 * each kind puts at stake: its territories' for a boundary or a clique, its
 * chronic hotspots' for a hotspot, its files' for an entry about files.
 */
const STAKES: Record<EntryKind, string> = {
  boundary: "heatShare",
  clique: "heatShare",
  hotspot: "chronicHeatShare",
  copies: "heatShare",
  hub: "heatShare",
  coupling: "heatShare",
};

/** The heat of a file as the engine counts it. */
const heatOf = ({ changes, loc, complexity }: FileStats): number =>
  changes * (loc + complexity.total);

const sumOf = (values: readonly number[]): number =>
  values.reduce((sum, value) => sum + value, 0);

const viewOf = (
  entry: EntryPoint,
  index: TerritoryIndex,
  shortName: (territory: Territory) => string,
): EntryView => {
  const territories = territoriesOf(entry.territories, index);
  const [primary] = entry.findings;
  const move = splitMove(entry.designMove);
  const subject = subjectOf(entry.kind, entry.files);
  return {
    rank: entry.rank,
    kind: entry.kind,
    kindLabel: KIND_LABELS[entry.kind],
    name:
      subject === ""
        ? territories.map((each) => shortName(each)).join(" + ")
        : subject,
    title:
      subject === ""
        ? territories.map((each) => territoryName(each)).join(" + ")
        : entry.files.join(", "),
    heatShare: entry.evidence[STAKES[entry.kind]] ?? 0,
    verdict: entry.verdict,
    moveLabel: move.label === "" ? KIND_LABELS[entry.kind] : move.label,
    move: move.rest,
    stats: statsOf(entry.kind, primary?.evidence ?? entry.evidence),
  };
};

/** The report's entry points, best first, as the page shows them. Empty when the report has none. */
export const entryViewsOf = (
  report: Analysis,
  index: TerritoryIndex,
): EntryView[] => {
  const parts = distinctNameParts(index.recommended);
  return report.entryPoints.map((entry) =>
    viewOf(entry, index, (territory) => parts(territory).base),
  );
};

/**
 * The share of all the heat (from the report's files) in the territories of
 * the top entry points, each
 * territory counted whole and once (an entry about files counts the
 * territories that hold them); `null` without entry points, 0 without heat.
 */
export const topEntriesCodeHeat = (
  report: Analysis,
  index: TerritoryIndex,
): number | null => {
  const top = report.entryPoints.slice(0, TOP_ENTRY_POINTS);
  if (top.length === 0) {
    return null;
  }
  const held = new Set(
    territoriesOf(
      top.flatMap(({ territories }) => territories),
      index,
    ).map(({ id }) => id),
  );
  const total = sumOf(report.files.map((file) => heatOf(file)));
  const inTop = sumOf(
    report.files
      .filter(({ territory }) => held.has(index.visibleOf(territory)?.id ?? ""))
      .map((file) => heatOf(file)),
  );
  return total === 0 ? 0 : inTop / total;
};

/**
 * What to say in place of the places to start when the report has none: a
 * report that predates territories, a window without counted changes, or a
 * repository that was judged and where nothing stands out.
 */
export const noEntriesNote = ({ territories, window }: Analysis): string => {
  if (territories.nodes.length === 0) {
    return "This report has no territories or entry points; analyze again with a current codeheat to see where to start.";
  }
  if (window.realCommits === 0) {
    return "No counted changes in this window, so there is nothing to rank; try a longer window with --since.";
  }
  return "Nothing stands out: no place has enough evidence to rank.";
};
