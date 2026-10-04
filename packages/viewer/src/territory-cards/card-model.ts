// Owns what a territory card face says: a territory at one detail turned into
// plain words and numbers, with the places to link to.
import type { FileStats, Report } from "@codeheat/engine";

import { cohesionStep } from "../color/cohesion-scale.js";
import type { EntryView } from "../entry-points/entry-views.js";
import { descriptionOf } from "../fit-map/fit-tiles.js";
import { judgeTerritory } from "../territories/judgement.js";
import {
  isRealTerritory,
  territoryName,
  territoryNameParts,
} from "../territories/territory-index.js";
import type {
  NameParts,
  Territory,
  TerritoryIndex,
} from "../territories/territory-index.js";
import { attachableEntries, concerningOf } from "./entry-attachment.js";
import type { AttachableEntry } from "./entry-attachment.js";
import { findingsOf } from "./findings.js";
import type { CardFinding } from "./findings.js";
import { codeFirst } from "./level-index.js";
import type { LevelIndex } from "./level-index.js";

/** Everything the cards derive from, taken from the report once. */
export type CardSource = {
  readonly territories: TerritoryIndex;
  /** Hottest first, as the report lists them. */
  readonly files: readonly FileStats[];
  /** The places to start, best first, with what they concern. */
  readonly entries: readonly AttachableEntry[];
  readonly thresholds: Report["thresholds"];
  /** The share of the counted changes that are fixes in the repository; `null` when commit subjects do not tell. */
  readonly fixShare: number | null;
  readonly couplings: Report["couplings"];
  /** The files the report lists, by path. */
  readonly filesByPath: ReadonlyMap<string, FileStats>;
  /** The changes that count (`window.couplingCommits`: the logical changes within the size limit `maxCommitFiles`, which `Territory.changes` counts too), and the code files of the repository. */
  readonly totals: { readonly changes: number; readonly files: number };
};

/** The territory a card's changes reach into most. */
export type CardPartner = {
  readonly name: string;
  readonly sharedChanges: number;
  /** The territory's own counted changes, which `sharedChanges` is a part of. */
  readonly ofChanges: number;
};

/** Where a card points on the fit map. */
type FitLink = {
  readonly territory: string;
  /** The tile shows the territory itself; otherwise it shows the territory that contains it, named `name`. */
  readonly exact: boolean;
  readonly name: string;
};

/** A territory card at one detail: the face, and what the expanded card builds on. */
export type TerritoryCard = {
  readonly territory: Territory;
  readonly name: string;
  readonly nameParts: NameParts;
  readonly description: string;
  /** Test code and buckets of leftovers are shown, but quieter than the territories of the design. */
  readonly quiet: boolean;
  readonly heatShare: number;
  /** The share of its changes that stay inside; `null` when it is not judged (see `noData`). */
  readonly containment: number | null;
  readonly noData: string | null;
  /** The color step of its containment (see `cohesionStep`). */
  readonly step: number;
  /** Its hottest file, when the report lists one. */
  readonly hottest: FileStats | null;
  readonly partner: CardPartner | null;
  /** All findings, most telling first; the face shows the first few. */
  readonly findings: readonly CardFinding[];
  readonly fitLink: FitLink | null;
};

/** The places to start whose territories lie inside `territory` at this detail. */
const partnerOf = (
  territory: Territory,
  index: TerritoryIndex,
): CardPartner | null => {
  const partner = territory.fit?.partner ?? null;
  const other =
    partner === null ? undefined : index.byId.get(partner.territory);
  return partner === null || other === undefined
    ? null
    : {
        name: territoryName(other),
        sharedChanges: partner.sharedChanges,
        ofChanges: territory.changes,
      };
};

/** The territory links to its own tile on the fit map, or to the tile that contains it; one that is finer than the map's tiles has no tile of its own. */
const fitLinkOf = (
  territory: Territory,
  index: TerritoryIndex,
): FitLink | null => {
  const tile = index.visibleOf(territory.id);
  return tile === undefined
    ? null
    : {
        territory: tile.id,
        exact: tile.id === territory.id,
        name: territoryName(tile),
      };
};

/** The cards of the territories at `level`, in the report's order: the hottest real territory first, test code and buckets last. */
export const cardsOf = (
  source: CardSource,
  level: LevelIndex,
): TerritoryCard[] =>
  level.territories.map((territory) => {
    const { containment, reason } = judgeTerritory(
      territory,
      source.thresholds,
    );
    return {
      territory,
      name: territoryName(territory),
      nameParts: territoryNameParts(territory),
      description: descriptionOf(territory),
      quiet: !isRealTerritory(territory),
      heatShare: territory.heatShare,
      containment,
      noData: reason,
      step: cohesionStep(containment),
      hottest: codeFirst(level.filesOf(territory.id))[0] ?? null,
      partner: partnerOf(territory, source.territories),
      findings: findingsOf(
        territory,
        concerningOf(territory, level, source.territories.byId, source.entries),
        {
          fixShare: source.fixShare,
          minChanges: source.thresholds.minModuleCommits,
        },
      ),
      fitLink: fitLinkOf(territory, source.territories),
    };
  });

/** What the cards need from `report`, with the places to start already read. */
export const cardSourceOf = (
  report: Report,
  territories: TerritoryIndex,
  entries: readonly EntryView[],
): CardSource => {
  const filesByPath = new Map(report.files.map((file) => [file.path, file]));
  return {
    territories,
    files: report.files,
    entries: attachableEntries(report, entries, filesByPath),
    thresholds: report.thresholds,
    fixShare: report.fixDensity.share,
    couplings: report.couplings,
    filesByPath,
    totals: {
      changes: report.window.couplingCommits,
      files:
        report.territories.nodes.find(({ parent }) => parent === null)?.files ??
        report.totals.files,
    },
  };
};
