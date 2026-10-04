// Owns what the lists under the matrix say: territories that change as one
// unit, file pairs that change together across boundaries, and families of
// copies, each with the numbers behind it. Every number is the report's own.
import type { Report } from "@codeheat/engine";

import type { EntryStat } from "../entry-points/evidence.js";
import { formatCount, formatShare } from "../render/format.js";
import {
  isRealTerritory,
  territoryName,
} from "../territories/territory-index.js";
import type { TerritoryIndex } from "../territories/territory-index.js";

/** A territory a list names, for linking to the fit map. */
export type TerritoryRef = { readonly id: string; readonly name: string };

export type CliqueView = {
  readonly members: readonly TerritoryRef[];
  readonly stats: readonly EntryStat[];
};

export type FilePairView = {
  readonly a: string;
  readonly b: string;
  /** The territory of each file at the recommended detail; `null` for a file in a bucket, in test code, or that the report does not list. */
  readonly territories: readonly [TerritoryRef | null, TerritoryRef | null];
  /** Whether an import links the two files, in words. */
  readonly imports: string;
  /** Whether no import links them: hidden coupling. */
  readonly hidden: boolean;
  /** Whether the files lie in different territories, or how many folders apart they are, in words. */
  readonly apart: string;
  readonly stats: readonly EntryStat[];
};

export type FamilyView = {
  readonly files: readonly string[];
  readonly stats: readonly EntryStat[];
};

const count = (value: number, label: string): EntryStat => ({
  value: formatCount(value),
  label,
});

const share = (value: number, label: string): EntryStat => ({
  value: formatShare(value),
  label,
});

/** The cliques of territories (see `Report.territoryCliques`) with the changes that touched them all and the heat they hold; a member the report does not know is left out of the names. */
export const cliqueViews = (
  report: Report,
  index: TerritoryIndex,
): CliqueView[] =>
  report.territoryCliques.map((clique) => ({
    members: clique.territories.flatMap((id) => {
      const territory = index.byId.get(id);
      return territory === undefined
        ? []
        : [{ id, name: territoryName(territory) }];
    }),
    stats: [
      count(clique.sharedChanges, "changes touched all of them"),
      share(
        clique.weakestShare,
        "of the smaller one's changes in the weakest pair",
      ),
      share(clique.heatShare, "of the change effort together"),
    ],
  }));

const IMPORTS: Record<string, string> = {
  none: "no import between them",
  "a→b": "the first imports the second",
  "b→a": "the second imports the first",
  both: "each imports the other",
};

const importsOf = (relation: string | null): string =>
  relation === null
    ? "import relation not known"
    : (IMPORTS[relation] ?? "import relation not known");

/** How far apart the files of a pair lie in the design, in words: in different territories (at the recommended detail), or how many folders apart inside one. */
const apartOf = (
  distance: number,
  territories: readonly [string | undefined, string | undefined],
): string => {
  const [a, b] = territories;
  return a !== undefined && b !== undefined && a !== b
    ? "in different territories"
    : `${formatCount(distance)} folders apart`;
};

/**
 * The file pairs that change together across boundaries or far apart
 * (`Report.distantCouplings`, best first, which ranks hidden coupling first),
 * with the territory of each file.
 */
export const filePairViews = (
  report: Report,
  index: TerritoryIndex,
): FilePairView[] => {
  const territoryOfFile = new Map(
    report.files.map(({ path, territory }) => [path, territory]),
  );
  const refOf = (path: string): TerritoryRef | null => {
    const id = territoryOfFile.get(path);
    const territory = id === undefined ? undefined : index.visibleOf(id);
    return territory === undefined || !isRealTerritory(territory)
      ? null
      : { id: territory.id, name: territoryName(territory) };
  };
  const visibleId = (path: string): string | undefined => {
    const id = territoryOfFile.get(path);
    return id === undefined ? undefined : index.visibleOf(id)?.id;
  };
  return report.distantCouplings.map((pair) => ({
    a: pair.a,
    b: pair.b,
    territories: [refOf(pair.a), refOf(pair.b)],
    imports: importsOf(pair.imports),
    hidden: pair.imports === "none",
    apart: apartOf(pair.distance, [visibleId(pair.a), visibleId(pair.b)]),
    stats: [
      count(pair.sharedCommits, "shared changes"),
      share(pair.strength, "coupling degree"),
    ],
  }));
};

const similarity = ({
  min,
  max,
}: Report["copyFamilies"][number]["similarity"]) =>
  min === max ? formatShare(max) : `${formatShare(min)} to ${formatShare(max)}`;

/** The families of copies that are not test code only, as the report ranks them. */
export const familyViews = (report: Report): FamilyView[] =>
  report.copyFamilies
    .filter(({ testOnly }) => !testOnly)
    .map((family) => ({
      files: family.files,
      stats: [
        { value: similarity(family.similarity), label: "alike" },
        count(family.sharedChanges, "changes touched at least two"),
        count(family.changesToAll, "touched all of them"),
      ],
    }));

/** How many copy families are test code only, which the list leaves out. */
export const testOnlyFamilies = (report: Report): number =>
  report.copyFamilies.filter(({ testOnly }) => testOnly).length;
