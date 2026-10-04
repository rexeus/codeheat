// Owns what a territory card says is wrong: the places to start that concern
// it, then what its own numbers add, and which few of them the card face shows.

import type { EntryView } from "../entry-points/entry-views.js";
import type { EntryKind, EntryStat } from "../entry-points/evidence.js";
import { formatCount, formatShare } from "../render/format.js";
import { isRealTerritory } from "../territories/territory-index.js";
import type { Territory } from "../territories/territory-index.js";

/** One thing worth knowing about a territory, with the numbers behind it. */
export type CardFinding = {
  /** A short name for what it is: the kind of the place to start, or `Eroding`. */
  readonly label: string;
  /** The files it is about in one phrase, such as the hub or the copies; empty when it is about a territory. */
  readonly subject: string;
  /** The rank of the place to start it comes from; `null` for a finding from the territory's own numbers. */
  readonly rank: number | null;
  /** Which part of the territory (`in a, b`) or which containing territory (`within x`) its place to start concerns; empty when it concerns the territory itself or comes from its own numbers. */
  readonly where: string;
  /** The sentence the place to start gives for it; empty for a finding from the territory's own numbers. */
  readonly verdict: string;
  readonly stats: readonly EntryStat[];
};

/** How many findings a card face shows; the others wait in the expanded card. */
export const FACE_FINDINGS = 3;

/** How many points above the repository's share of fixes a territory's share must lie to be called out. */
const FIX_EXCESS = 0.15;

type Fit = NonNullable<Territory["fit"]>;

/** What the report knows about the repository that decides whether a number stands out. */
export type FindingContext = {
  /** The share of the counted changes that are fixes in the whole repository; `null` when commit subjects do not tell. */
  readonly fixShare: number | null;
  /** Fewest counted changes a territory needs to be judged (`Thresholds.minModuleCommits`). */
  readonly minChanges: number;
};

/** A place to start that belongs on the card of a territory, and how it concerns it. */
export type Concerning = {
  readonly entry: EntryView;
  /** Which part of the card's territory (`in a, b`) or which containing territory (`within x`) it concerns; empty when it concerns the territory itself. */
  readonly where: string;
  /** The entry names the territory itself. */
  readonly itself: boolean;
};

const fromEntry = ({
  entry: { rank, kindLabel, subject, verdict, stats, also },
  where,
}: Concerning): CardFinding[] => [
  { label: kindLabel, subject, rank, where, verdict, stats },
  ...also.map((finding) => ({
    label: finding.kindLabel,
    subject: finding.subject,
    rank,
    where,
    verdict: finding.verdict,
    stats: finding.stats,
  })),
];

/** A finding drawn from the territory's `fit`; `says` is the kind of entry point that already says it. */
type Reading = {
  readonly says: readonly EntryKind[];
  readonly finding: CardFinding | null;
};

const own = (label: string, stats: readonly EntryStat[]): CardFinding => ({
  label,
  subject: "",
  rank: null,
  where: "",
  verdict: "",
  stats,
});

const erosionReading = (fit: Fit): Reading => {
  const { erosion } = fit;
  return {
    says: ["boundary"],
    finding:
      erosion?.verdict === "eroding"
        ? own("Eroding", [
            {
              value: `${formatShare(erosion.from)} → ${formatShare(erosion.to)}`,
              label: `of its changes stay inside, over ${formatCount(erosion.windows)} quarters`,
            },
          ])
        : null,
  };
};

const chronicReading = (fit: Fit): Reading => ({
  says: ["hotspot"],
  finding:
    fit.chronicFiles > 0
      ? own("Chronic hotspots", [
          {
            value: formatCount(fit.chronicFiles),
            label:
              fit.chronicFiles === 1
                ? "file hot quarter after quarter"
                : "files hot quarter after quarter",
          },
          {
            value: formatShare(fit.chronicShare),
            label: "of its own effort is chronic",
          },
        ])
      : null,
});

const pairsReading = (fit: Fit): Reading => {
  const hidden = fit.hiddenPairs > 0;
  const count = hidden ? fit.hiddenPairs : fit.distantPairs;
  return {
    says: ["boundary", "coupling"],
    finding:
      count > 0
        ? own(hidden ? "Hidden coupling" : "Coupled across its edge", [
            {
              value: formatCount(count),
              label: hidden
                ? "file pairs across its edge change together with no import between them"
                : "file pairs across its edge change together",
            },
          ])
        : null,
  };
};

const fixesReading = (fit: Fit, context: FindingContext): Reading => {
  const { fixDensity } = fit;
  const { fixShare, minChanges } = context;
  const stands =
    fixDensity !== null &&
    fixShare !== null &&
    fixDensity.fixes >= minChanges &&
    fixDensity.share >= fixShare + FIX_EXCESS;
  return {
    says: [],
    finding: stands
      ? own("Many fixes", [
          {
            value: formatShare(fixDensity.share),
            label: `of its changes are fixes (the repository: ${formatShare(fixShare)})`,
          },
        ])
      : null,
  };
};

/**
 * Every finding about a territory, most telling first: the places to start
 * that `concerning` it, best rank first as the report lists them (an entry's
 * other findings follow its primary one; one that concerns a part of the
 * territory says which); then what the territory's own numbers add that no
 * place to start about the territory itself already says, in this order: eroding, chronic hotspots, coupling
 * across its edge, many fixes. Only a real territory has own findings.
 * A card face shows the first `FACE_FINDINGS`.
 */
export const findingsOf = (
  territory: Territory,
  concerning: readonly Concerning[],
  context: FindingContext,
): CardFinding[] => {
  const said = new Set<EntryKind>();
  for (const { entry, itself } of concerning) {
    if (itself) {
      said.add(entry.kind);
      for (const { kind } of entry.also) {
        said.add(kind);
      }
    }
  }
  const { fit } = territory;
  const readings =
    fit === null || !isRealTerritory(territory)
      ? []
      : [
          erosionReading(fit),
          chronicReading(fit),
          pairsReading(fit),
          fixesReading(fit, context),
        ];
  return [
    ...concerning.flatMap((entry) => fromEntry(entry)),
    ...readings.flatMap(({ says, finding }) =>
      finding === null || says.some((kind) => said.has(kind)) ? [] : [finding],
    ),
  ];
};
