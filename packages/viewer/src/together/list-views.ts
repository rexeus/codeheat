import type { EntryStat } from "../entry-points/evidence.js";
import { h } from "../render/dom.js";
import { fileLink } from "../render/file-link.js";
import type { FileLinkContext } from "../render/file-link.js";
import { splitPath } from "../render/format.js";
import type {
  CliqueView,
  FamilyView,
  FilePairView,
  TerritoryRef,
} from "./together-lists.js";

/** Entries a list shows before the rest wait behind a button. */
const VISIBLE = 5;

/** The most entries a list ever draws, so a long report does not make a long page. */
const MOST = 25;

const statsView = (stats: readonly EntryStat[]): HTMLElement =>
  h(
    "ul",
    "tg-stats",
    ...stats.map(({ value, label }) =>
      h("li", "tg-stat", h("strong", "", value), ` ${label}`),
    ),
  );

/** A territory's name as a link to its tile in the fit map. */
const territoryLink = ({ id, name }: TerritoryRef): HTMLElement => {
  const link = h("a", "tg-territory", name);
  link.href = `#territory-${id}`;
  link.title = `${name} on the fit map`;
  return link;
};

const cliqueItem = ({ members, stats }: CliqueView): HTMLElement =>
  h(
    "li",
    "tg-item",
    h(
      "p",
      "tg-title tg-members",
      ...members.map((member) => territoryLink(member)),
    ),
    statsView(stats),
  );

const fileLine = (
  path: string,
  territory: TerritoryRef | null,
  context: FileLinkContext,
): HTMLElement => {
  return h(
    "p",
    "tg-file",
    fileLink(path, context),
    territory === null
      ? h("span", "tg-dir", splitPath(path).dir)
      : territoryLink(territory),
  );
};

const pairItem = (pair: FilePairView, context: FileLinkContext): HTMLElement =>
  h(
    "li",
    "tg-item",
    fileLine(pair.a, pair.territories[0], context),
    fileLine(pair.b, pair.territories[1], context),
    h(
      "p",
      "tg-marks",
      h("span", pair.hidden ? "chip hidden" : "chip", pair.imports),
      h("span", "chip", pair.apart),
    ),
    statsView(pair.stats),
  );

const MAX_FAMILY_FILES = 4;

/** A copy named by its folder and file, since copies share their file name. */
const copyLabel = (path: string): string => {
  const { dir, name } = splitPath(path);
  const folder = dir.split("/").at(-2);
  return folder === undefined ? name : `${folder}/${name}`;
};

const familyItem = (
  { files, stats }: FamilyView,
  context: FileLinkContext,
): HTMLElement => {
  const shown = files.slice(0, MAX_FAMILY_FILES);
  const rest = files.length - shown.length;
  return h(
    "li",
    "tg-item",
    h(
      "p",
      "tg-title",
      h("strong", "", `${files.length} files`),
      ...shown.map((path) => fileLink(path, context, copyLabel(path))),
      ...(rest > 0 ? [h("span", "muted", `+${rest} more`)] : []),
    ),
    statsView(stats),
  );
};

/** The first entries, the rest behind a summary; at most `MOST` in all. */
const listOf = <T>(
  entries: readonly T[],
  item: (entry: T) => HTMLElement,
): HTMLElement[] => {
  const shown = entries.slice(0, MOST);
  const first = h(
    "ul",
    "tg-list",
    ...shown.slice(0, VISIBLE).map((entry) => item(entry)),
  );
  if (shown.length <= VISIBLE) {
    return [first];
  }
  return [
    first,
    h(
      "details",
      "tg-more",
      h("summary", "", `Show ${shown.length - VISIBLE} more`),
      h("ul", "tg-list", ...shown.slice(VISIBLE).map((entry) => item(entry))),
    ),
  ];
};

const card = (
  title: string,
  intro: string,
  body: readonly Node[],
): HTMLElement =>
  h(
    "section",
    "tg-card",
    h("header", "tg-head", h("h3", "", title), h("p", "tg-sub", intro)),
    ...body,
  );

const empty = (text: string): HTMLElement => h("p", "tg-empty", text);

/** Territories that change as one unit, each member linking to its tile in the fit map. */
export const cliqueCard = (cliques: readonly CliqueView[]): HTMLElement =>
  card(
    "Territories that change as one unit",
    "Three or more parts that almost always change in the same changes: one unit cut by boundaries, or an abstraction that is missing.",
    cliques.length === 0
      ? [empty("No group of three or more territories changes as one unit.")]
      : listOf(cliques, (clique) => cliqueItem(clique)),
  );

/** The file pairs that change together across boundaries, hidden coupling first, each file linking to the map. */
export const pairsCard = (
  pairs: readonly FilePairView[],
  context: FileLinkContext,
): HTMLElement =>
  card(
    "Files that change together across boundaries",
    "Pairs in different modules or far apart, best first; a pair with no import between them is coupling the code does not show.",
    pairs.length === 0
      ? [empty("No coupled pair lies far apart in the design.")]
      : listOf(pairs, (pair) => pairItem(pair, context)),
  );

/** Families of near-identical files that keep changing in lockstep, each file linking to the map. */
export const familiesCard = (
  families: readonly FamilyView[],
  testOnly: number,
  context: FileLinkContext,
): HTMLElement =>
  card(
    "Copies that change in lockstep",
    "Files with largely the same content that change in the same changes: the same edit applied to each copy.",
    [
      ...(families.length === 0
        ? [empty("No family of copies changes in lockstep.")]
        : listOf(families, (family) => familyItem(family, context))),
      ...(testOnly === 0
        ? []
        : [
            h(
              "p",
              "tg-note",
              `${testOnly} ${testOnly === 1 ? "family" : "families"} of test code only left out.`,
            ),
          ]),
    ],
  );
