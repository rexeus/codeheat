// Owns what a place to start says on the page: the engine's entry points
// (rank, kind, verdict, design move, evidence) turned into plain words,
// the numbers to show, and the places on the page and in the map to link to.
import type { Report } from "@codeheat/engine";

import { splitPath } from "../render/format.js";
import {
  isRealTerritory,
  territoryName,
} from "../territories/territory-index.js";
import type {
  Territory,
  TerritoryIndex,
} from "../territories/territory-index.js";
import { statsOf } from "./evidence.js";
import type { EntryKind, EntryStat } from "./evidence.js";

type EntryPoint = Report["entryPoints"][number];

const KIND_LABELS: Record<EntryKind, string> = {
  boundary: "Boundary",
  hotspot: "Hotspot",
  clique: "Clique",
  copies: "Copies",
  hub: "Hub",
  coupling: "Hidden coupling",
};

/** A finding of an entry point beside its primary one. */
export type FindingView = {
  readonly kind: EntryKind;
  readonly kindLabel: string;
  readonly verdict: string;
  readonly stats: readonly EntryStat[];
};

/** How many entry points the hero shows and the verdict sums up. */
export const TOP_ENTRY_POINTS = 3;

/** The territory a boundary's changes reach into most, from the fit of the territory. */
export type LeakTarget = {
  readonly name: string;
  /** Counted changes that touched both territories. */
  readonly sharedChanges: number;
  /** Share of the territory's changes that also touched the other, 0..1. */
  readonly share: number;
};

/** What the page shows for one entry point. */
export type EntryView = {
  readonly rank: number;
  /** The `id` of its card, which the fit map and the hero link to. */
  readonly anchor: string;
  readonly kind: EntryKind;
  readonly kindLabel: string;
  /** The names it concerns, one per line: territories, or files; the second file of a coupling. */
  readonly heading: readonly string[];
  /** The heading on one short line, for a one-liner: file names without their folders. */
  readonly shortHeading: string;
  /** What the heading is: one line of context, e.g. what a territory is or where a file lives. */
  readonly context: string;
  readonly verdict: string;
  /** The verb phrase of the design move (`Move a boundary`), or an empty string when the move has none. */
  readonly moveLabel: string;
  /** The design move without its verb phrase. */
  readonly move: string;
  readonly stats: readonly EntryStat[];
  /** Where a boundary leaks to; `null` for other kinds and where no territory takes a noticeable share. */
  readonly leaksTo: LeakTarget | null;
  /** The other findings about the same place, weaker first to last. */
  readonly also: readonly FindingView[];
  /** The territories (at the recommended detail) it concerns, for linking to the fit map. */
  readonly territories: readonly Territory[];
  /** Files the entry names, for linking into the map. */
  readonly files: readonly string[];
};

/** How many of the hottest files of the territories a card offers when the entry names none. */
const HOTTEST_FILES = 3;

const capitalized = (text: string): string =>
  text.slice(0, 1).toUpperCase() + text.slice(1);

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

type Place = {
  readonly files: readonly string[];
  readonly territories: readonly Territory[];
};

const territoryPaths = ({ territories }: Place): string[] =>
  territories.map((territory) => territoryName(territory));

const HEADINGS: Record<EntryKind, (place: Place) => string[]> = {
  boundary: territoryPaths,
  hotspot: territoryPaths,
  clique: territoryPaths,
  hub: ({ files }) => files.slice(0, 1),
  copies: ({ files }) => files.slice(0, 2),
  coupling: ({ files }) => [...files],
};

const inPlaces = ({ territories }: Place): string =>
  territories.length === 0
    ? ""
    : `in ${territories.map(({ path }) => path).join(", ")}`;

const CONTEXTS: Record<EntryKind, (place: Place) => string> = {
  boundary: ({ territories }) => territories[0]?.description ?? "",
  hotspot: ({ territories }) => territories[0]?.description ?? "",
  clique: ({ territories }) =>
    `${territories.length} territories that change as one unit`,
  copies: (place) =>
    `${place.files.length} near-identical files, ${inPlaces(place)}`,
  hub: inPlaces,
  coupling: inPlaces,
};

const FILE_KINDS = new Set<EntryKind>(["copies", "hub", "coupling"]);

const shortHeadingOf = (kind: EntryKind, heading: readonly string[]): string =>
  FILE_KINDS.has(kind)
    ? heading.map((path) => splitPath(path).name).join(" ↔ ")
    : heading.join(" + ");

const territoriesOf = (
  { territories: ids }: EntryPoint,
  index: TerritoryIndex,
): Territory[] => {
  const seen = new Set<string>();
  return ids.flatMap((id) => {
    const visible = index.visibleOf(id);
    if (visible === undefined || seen.has(visible.id)) {
      return [];
    }
    seen.add(visible.id);
    return [visible];
  });
};

/** The files an entry names itself or in its findings, each once; empty for a pure boundary or clique. */
const namedFiles = ({ files, findings }: EntryPoint): string[] => [
  ...new Set([...files, ...findings.flatMap((finding) => finding.files)]),
];

/** The hottest files of the territories, for an entry that names none; `files` is hottest first. */
const hottestFiles = (
  territories: readonly Territory[],
  report: Report,
  index: TerritoryIndex,
): string[] => {
  const wanted = new Set(
    territories
      .filter((territory) => isRealTerritory(territory))
      .map(({ id }) => id),
  );
  return report.files
    .filter(({ territory }) => wanted.has(index.visibleOf(territory)?.id ?? ""))
    .slice(0, HOTTEST_FILES)
    .map(({ path }) => path);
};

/** Where the boundary of the entry's one territory leaks to: the territory it changes with most. */
const leakTargetOf = (
  entry: EntryPoint,
  territories: readonly Territory[],
  index: TerritoryIndex,
): LeakTarget | null => {
  const isBoundary =
    entry.kind === "boundary" ||
    entry.findings.some(({ kind }) => kind === "boundary");
  const partner = territories[0]?.fit?.partner ?? null;
  if (!isBoundary || territories.length !== 1 || partner === null) {
    return null;
  }
  const other =
    index.visibleOf(partner.territory) ?? index.byId.get(partner.territory);
  return other === undefined
    ? null
    : {
        name: territoryName(other),
        sharedChanges: partner.sharedChanges,
        share: partner.share,
      };
};

const viewOf = (
  entry: EntryPoint,
  report: Report,
  index: TerritoryIndex,
): EntryView => {
  const territories = territoriesOf(entry, index);
  const [primary, ...others] = entry.findings;
  const move = splitMove(entry.designMove);
  const named = namedFiles(entry);
  const place = { files: entry.files, territories };
  const heading = HEADINGS[entry.kind](place);
  return {
    rank: entry.rank,
    anchor: `entry-${entry.rank}`,
    kind: entry.kind,
    kindLabel: KIND_LABELS[entry.kind],
    heading,
    shortHeading: shortHeadingOf(entry.kind, heading),
    context: CONTEXTS[entry.kind](place),
    verdict: entry.verdict,
    moveLabel: move.label,
    move: move.rest,
    stats: statsOf(entry.kind, primary?.evidence ?? entry.evidence),
    leaksTo: leakTargetOf(entry, territories, index),
    also: others.map((finding) => ({
      kind: finding.kind,
      kindLabel: KIND_LABELS[finding.kind],
      verdict: finding.verdict,
      stats: statsOf(finding.kind, finding.evidence, 3),
    })),
    territories,
    files: named.length > 0 ? named : hottestFiles(territories, report, index),
  };
};

/** The report's entry points, best first, as the page shows them. Empty when the report has none. */
export const entryViewsOf = (
  report: Report,
  index: TerritoryIndex,
): EntryView[] =>
  report.entryPoints.map((entry) => viewOf(entry, report, index));

/**
 * What to say in place of the places to start when the report has none: a
 * report that predates territories, a window without counted changes, or a
 * repository that was judged and where nothing stands out.
 */
export const noEntriesNote = ({ territories, window }: Report): string => {
  if (territories.nodes.length === 0) {
    return "This report has no territories or entry points; analyze again with a current codeheat to see where to start.";
  }
  if (window.realCommits === 0) {
    return "No counted changes in this window, so there is nothing to rank; try a longer window with --since.";
  }
  return "Nothing stands out: no territory is both hot enough and leaky enough to be a place to start.";
};
