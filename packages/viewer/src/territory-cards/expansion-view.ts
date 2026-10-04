import { breakable, h } from "../render/dom.js";
import { fileLink } from "../render/file-link.js";
import type { FileLinkContext } from "../render/file-link.js";
import {
  formatCount,
  formatScore,
  formatShare,
  splitPath,
} from "../render/format.js";
import type { TerritoryCard } from "./card-model.js";
import type { CouplingPartner } from "./coupling-partners.js";
import type {
  Expansion,
  HotFile,
  InnerTerritory,
  StatRow,
} from "./expansion.js";
import type { CardFinding } from "./findings.js";
import { meterView } from "./meter-view.js";

/** The id of the expanded part of the card `id`, which its expand button controls. */
export const moreId = (id: string): string => `card-${id}-more`;

const block = (title: string, ...content: readonly Node[]): HTMLElement =>
  h("section", "tcard-block", h("h4", "tcard-block-title", title), ...content);

const statRow = ({ label, value, reference, meter }: StatRow): HTMLElement =>
  h(
    "li",
    "tcard-stat",
    h("span", "tcard-stat-label", label),
    h("strong", "tcard-stat-value", value),
    ...(meter === null ? [] : [meterView(meter.value, meter.reference)]),
    h("span", "tcard-stat-ref", reference),
  );

const HEAT_WORDS = { chronic: "chronic", acute: "acute" } as const;

const hotFileRow = (
  { file, heat }: HotFile,
  files: FileLinkContext,
): HTMLElement =>
  h(
    "li",
    "tcard-file",
    fileLink(file.path, files),
    h("span", "tcard-file-dir muted", splitPath(file.path).dir),
    h(
      "span",
      "tcard-file-numbers",
      ...(heat === null ? [] : [h("span", "chip", HEAT_WORDS[heat])]),
      `score ${formatScore(file.score)} · ${formatCount(file.revisions)} revisions`,
    ),
  );

const partnerRow = ({
  name,
  pairs,
  hiddenPairs,
  strongest,
}: CouplingPartner): HTMLElement =>
  h(
    "li",
    "tcard-partner-row",
    h("strong", "", ...breakable(name)),
    h(
      "span",
      "",
      `${formatCount(pairs)} file ${pairs === 1 ? "pair" : "pairs"} change together`,
      ...(hiddenPairs === 0
        ? []
        : [
            ` · `,
            h(
              "span",
              "tcard-hidden",
              `${formatCount(hiddenPairs)} with no import`,
            ),
          ]),
    ),
    h(
      "span",
      "muted",
      `closest: ${splitPath(strongest.a).name} ↔ ${splitPath(strongest.b).name}, ${formatCount(strongest.sharedChanges)} shared changes`,
    ),
  );

const innerRow = ({
  name,
  heatShare,
  containment,
}: InnerTerritory): HTMLElement =>
  h(
    "li",
    "tcard-inner",
    h("strong", "", ...breakable(name)),
    h(
      "span",
      "",
      `${formatShare(heatShare)} of the effort · `,
      containment === null
        ? "not judged"
        : `${formatShare(containment)} of its changes stay inside`,
    ),
  );

const findingRow = ({
  label,
  rank,
  where,
  verdict,
  stats,
}: CardFinding): HTMLElement =>
  h(
    "li",
    "tcard-all-finding",
    h("span", "chip", label),
    ...(where === "" ? [] : [h("strong", "", where)]),
    ...(rank === null ? [] : [h("span", "muted", `place to start #${rank}`)]),
    ...(verdict === "" ? [] : [h("p", "", verdict)]),
    h(
      "span",
      "tcard-finding-stats",
      stats.map(({ value, label: words }) => `${value} ${words}`).join(" · "),
    ),
  );

/** The sections of the expanded card; an empty one is left out. */
const sectionsOf = (
  card: TerritoryCard,
  expansion: Expansion,
  files: FileLinkContext,
): HTMLElement[] => [
  block(
    "Against the repository",
    h("ul", "tcard-stats", ...expansion.stats.map(statRow)),
  ),
  ...(card.findings.length === 0
    ? []
    : [
        block(
          "Findings",
          h("ul", "tcard-list", ...card.findings.map(findingRow)),
        ),
      ]),
  ...(expansion.hotFiles.length === 0
    ? []
    : [
        block(
          "Hottest files",
          h(
            "ol",
            "tcard-list",
            ...expansion.hotFiles.map((hot) => hotFileRow(hot, files)),
          ),
        ),
      ]),
  ...(expansion.partners.length === 0
    ? []
    : [
        block(
          "Changes together with",
          h("ul", "tcard-list", ...expansion.partners.map(partnerRow)),
        ),
      ]),
  ...(expansion.inner.length === 0
    ? []
    : [
        block(
          "Inside it, at the next detail",
          ...(expansion.splitReason === null
            ? []
            : [
                h(
                  "p",
                  "tcard-split",
                  `Splits because ${expansion.splitReason}.`,
                ),
              ]),
          h("ul", "tcard-list", ...expansion.inner.map(innerRow)),
        ),
      ]),
];

/** The part of a card that only an expanded one shows. */
export const expansionView = (
  id: string,
  card: TerritoryCard,
  expansion: Expansion,
  files: FileLinkContext,
): HTMLElement => {
  const element = h(
    "div",
    "tcard-more",
    ...(expansion.detailNote === null
      ? []
      : [h("p", "tcard-note", expansion.detailNote)]),
    h("div", "tcard-blocks", ...sectionsOf(card, expansion, files)),
  );
  element.id = moreId(id);
  return element;
};
