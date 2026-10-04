// Owns what an expanded territory card adds to its face: the territory against
// the repository, its hottest files, the territories it changes with, and the
// territories inside it.
import type { FileStats } from "@codeheat/engine";

import { formatCount, formatShare, splitPath } from "../render/format.js";
import { judgeTerritory } from "../territories/judgement.js";
import { territoryName } from "../territories/territory-index.js";
import type { CardSource, TerritoryCard } from "./card-model.js";
import { couplingPartnersOf } from "./coupling-partners.js";
import type { CouplingPartner } from "./coupling-partners.js";
import { codeFirst } from "./level-index.js";
import type { LevelIndex } from "./level-index.js";

/** One number of the territory with the repository's number beside it. */
export type StatRow = {
  readonly label: string;
  readonly value: string;
  /** The comparison in words, e.g. `the repository: 12%`. */
  readonly reference: string;
  /** Where the value and the comparison lie on a 0..1 scale, for a meter; `null` for a number without a scale. */
  readonly meter: {
    readonly value: number;
    readonly reference: number | null;
  } | null;
};

export type HotFile = {
  readonly file: FileStats;
  /** `chronic`, `acute`, or `null`: how long it has been among the hottest. */
  readonly heat: "chronic" | "acute" | null;
};

/** A territory inside the expanded one, at the next finer cut. */
export type InnerTerritory = {
  readonly name: string;
  readonly heatShare: number;
  /** Its containment when it is judged; `null` otherwise. */
  readonly containment: number | null;
};

export type Expansion = {
  readonly stats: readonly StatRow[];
  /** Said when the containment above is measured against another detail than the one shown; `null` otherwise. */
  readonly detailNote: string | null;
  readonly hotFiles: readonly HotFile[];
  readonly partners: readonly CouplingPartner[];
  /** Why the territory splits and into what; `inner` is empty when it does not. */
  readonly splitReason: string | null;
  readonly inner: readonly InnerTerritory[];
};

/** How many of its hottest files an expanded card lists. */
const HOT_FILES = 5;

const share = (part: number, whole: number): number =>
  whole === 0 ? 0 : Math.min(1, part / whole);

const median = (values: readonly number[]): number | null => {
  const sorted = values.toSorted((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length === 0) {
    return null;
  }
  return sorted.length % 2 === 1
    ? (sorted[middle] ?? 0)
    : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
};

/** The effort and the changes of the territory against its size and the whole window. */
const sizeRows = (
  { territory, heatShare }: TerritoryCard,
  { totals }: CardSource,
): StatRow[] => {
  const fileShare = share(territory.files, totals.files);
  const changeShare = share(territory.changes, totals.changes);
  return [
    {
      label: "Share of the change effort",
      value: formatShare(heatShare),
      reference: `its share of the files: ${formatShare(fileShare)}`,
      meter: { value: heatShare, reference: fileShare },
    },
    {
      label: "Counted changes touching it",
      value: formatCount(territory.changes),
      reference: `${formatShare(changeShare)} of ${formatCount(totals.changes)} in the window`,
      meter: { value: changeShare, reference: null },
    },
  ];
};

const containmentRow = (
  card: TerritoryCard,
  cards: readonly TerritoryCard[],
  level: number,
): StatRow => {
  if (card.containment === null) {
    return {
      label: "Changes that stay inside",
      value: "not judged",
      reference: card.noData ?? "",
      meter: null,
    };
  }
  const typical = median(
    cards.flatMap(({ quiet, containment, territory }) =>
      quiet || containment === null || territory.fit?.detail !== level
        ? []
        : [containment],
    ),
  );
  return {
    label: "Changes that stay inside",
    value: formatShare(card.containment),
    reference:
      typical === null
        ? `no territory is measured at detail ${level} to compare with`
        : `the median of the territories measured at detail ${level}: ${formatShare(typical)}`,
    meter: { value: card.containment, reference: typical },
  };
};

const fixRow = (
  { territory }: TerritoryCard,
  { fixShare }: CardSource,
): StatRow[] => {
  const fixes = territory.fit?.fixDensity ?? null;
  return fixes === null || fixShare === null
    ? []
    : [
        {
          label: "Changes that are fixes",
          value: formatShare(fixes.share),
          reference: `the repository: ${formatShare(fixShare)}`,
          meter: { value: fixes.share, reference: fixShare },
        },
      ];
};

/** What the territory's own fit and files add: heat of its files, reach of its changes, coupling across its edge. */
const reachRows = (
  { territory }: TerritoryCard,
  files: readonly FileStats[],
): StatRow[] => {
  const { fit } = territory;
  const widest = files.reduce<FileStats | null>(
    (best, file) =>
      best === null || file.breadth > best.breadth ? file : best,
    null,
  );
  return [
    ...(fit === null
      ? []
      : [
          {
            label: "Hot files",
            value: `${formatCount(fit.chronicFiles)} chronic · ${formatCount(fit.acuteFiles)} acute`,
            reference: `of ${formatCount(territory.files)} files`,
            meter: null,
          },
        ]),
    ...(fit === null || fit.radius === null
      ? []
      : [
          {
            label: "Territories a change here touches",
            value: formatCount(fit.radius),
            reference: "the median, itself included",
            meter: null,
          },
        ]),
    ...(fit === null
      ? []
      : [
          {
            label: "File pairs across its edge",
            value: formatCount(fit.distantPairs),
            reference: `${formatCount(fit.hiddenPairs)} with no import between them`,
            meter: null,
          },
        ]),
    ...(widest === null || widest.breadth === 0
      ? []
      : [
          {
            label: "Widest file",
            value: `${formatCount(widest.breadth)} files`,
            reference: `${splitPath(widest.path).name} changes with that many others`,
            meter: null,
          },
        ]),
  ];
};

const innerOf = (
  { territory }: TerritoryCard,
  { territories, thresholds }: CardSource,
): InnerTerritory[] =>
  territory.children.flatMap((id) => {
    const child = territories.byId.get(id);
    return child === undefined
      ? []
      : [
          {
            name: territoryName(child),
            heatShare: child.heatShare,
            containment:
              child.fit === null
                ? null
                : judgeTerritory(child, thresholds).containment,
          },
        ];
  });

/**
 * The expanded card of `card` at `level`; `cards` are all the cards at that
 * detail, which the median containment is taken over.
 */
export const expansionOf = (
  card: TerritoryCard,
  cards: readonly TerritoryCard[],
  level: LevelIndex,
  source: CardSource,
): Expansion => {
  const files = level.filesOf(card.territory.id);
  const { fit } = card.territory;
  return {
    stats: [
      ...sizeRows(card, source),
      containmentRow(card, cards, level.level),
      ...fixRow(card, source),
      ...reachRows(card, files),
    ],
    detailNote:
      fit !== null && fit.detail !== level.level
        ? `Containment, the territory it changes with most and the pairs across its edge are measured against the territories of detail ${fit.detail}.`
        : null,
    hotFiles: codeFirst(files)
      .slice(0, HOT_FILES)
      .map((file) => ({
        file,
        heat: file.heat?.kind ?? null,
      })),
    partners: couplingPartnersOf(card.territory.id, level, source),
    splitReason: card.territory.splitReason,
    inner: innerOf(card, source),
  };
};
