import type { EntryStat } from "../entry-points/evidence.js";
import { breakable, h } from "../render/dom.js";
import { fileLink } from "../render/file-link.js";
import type { FileLinkContext } from "../render/file-link.js";
import { formatCount, formatScore, formatShare } from "../render/format.js";
import { rankBadge } from "../render/rank-badge.js";
import type { CardPartner, TerritoryCard } from "./card-model.js";
import { expansionView, moreId } from "./expansion-view.js";
import type { Expansion } from "./expansion.js";
import { FACE_FINDINGS } from "./findings.js";
import type { CardFinding } from "./findings.js";
import { meterView } from "./meter-view.js";

/** How a card talks back to the section. */
export type CardHandlers = {
  readonly files: FileLinkContext;
  /** Expands the card, or collapses it when it is expanded. */
  readonly toggle: (id: string) => void;
};

/** The face's findings show this many numbers each. */
const FACE_STATS = 2;

/** The id of a card, which its expand button controls. */
export const cardId = (territory: string): string => `card-${territory}`;

const nameView = ({ nameParts }: TerritoryCard): HTMLElement =>
  h(
    "h3",
    "tcard-name",
    ...(nameParts.dir === ""
      ? []
      : [h("span", "tcard-dir", ...breakable(nameParts.dir))]),
    h("strong", "tcard-base", ...breakable(nameParts.base)),
  );

/** The best place to start that concerns the card as a badge that links to its card, and how many more there are, as on the fit map. */
const badgesOf = (findings: readonly CardFinding[]): HTMLElement[] => {
  const [best, ...rest] = new Set(
    findings.flatMap(({ rank }) => (rank === null ? [] : [rank])),
  );
  return best === undefined
    ? []
    : [
        h(
          "span",
          "tcard-badges",
          rankBadge(best, `#entry-${best}`),
          ...(rest.length > 0 ? [h("span", "muted", `+${rest.length}`)] : []),
        ),
      ];
};

const figure = (value: string, words: string): HTMLElement =>
  h("div", "tcard-figure", h("strong", "", value), h("span", "", words));

/** The two numbers the card is about, and a meter for the second. */
const figuresView = (card: TerritoryCard): HTMLElement => {
  const contained =
    card.containment === null
      ? h(
          "div",
          "tcard-figure tcard-unjudged",
          h("span", "", `Not judged: ${card.noData ?? ""}`),
        )
      : figure(formatShare(card.containment), "of its changes stay inside");
  contained.classList.add("tcard-contained");
  if (card.containment !== null) {
    contained.append(meterView(card.containment, null));
  }
  contained.dataset["fit"] = String(card.step);
  return h(
    "div",
    "tcard-figures",
    figure(formatShare(card.heatShare), "of the change effort"),
    contained,
  );
};

const hottestRow = (
  { hottest }: TerritoryCard,
  files: FileLinkContext,
): HTMLElement =>
  h(
    "p",
    "tcard-row",
    h("span", "tcard-key", "Hottest file"),
    ...(hottest === null
      ? [h("span", "muted", "none listed")]
      : [
          fileLink(hottest.path, files),
          h("span", "muted tcard-score", `score ${formatScore(hottest.score)}`),
        ]),
  );

const partnerRow = (partner: CardPartner | null): HTMLElement[] =>
  partner === null
    ? []
    : [
        h(
          "p",
          "tcard-row",
          h("span", "tcard-key", "Changes most with"),
          h("strong", "tcard-partner", ...breakable(partner.name)),
          h(
            "span",
            "muted tcard-score",
            `${formatCount(partner.sharedChanges)} of ${formatCount(partner.ofChanges)} changes`,
          ),
        ),
      ];

const statView = ({ value, label }: EntryStat): HTMLElement =>
  h("span", "tcard-pair", h("strong", "", value), ` ${label}`);

const findingView = ({ label, where, stats }: CardFinding): HTMLElement =>
  h(
    "li",
    "tcard-finding",
    h("span", "chip", label),
    ...(where === "" ? [] : [h("span", "tcard-where", `in ${where}`)]),
    h(
      "span",
      "tcard-finding-stats",
      ...stats
        .filter(({ value }) => value !== "0")
        .slice(0, FACE_STATS)
        .map((stat) => statView(stat)),
    ),
  );

const findingsView = (findings: readonly CardFinding[]): HTMLElement[] => {
  const more = findings.length - FACE_FINDINGS;
  return findings.length === 0
    ? []
    : [
        h(
          "ul",
          "tcard-findings",
          ...findings
            .slice(0, FACE_FINDINGS)
            .map((finding) => findingView(finding)),
          ...(more > 0
            ? [
                h(
                  "li",
                  "tcard-more-findings",
                  `${formatCount(more)} more ${more === 1 ? "finding" : "findings"} when expanded`,
                ),
              ]
            : []),
        ),
      ];
};

const mapLink = ({ fitLink }: TerritoryCard): HTMLElement[] => {
  if (fitLink === null) {
    return [];
  }
  const link = h(
    "a",
    "map-link",
    fitLink.exact ? "On the fit map" : `Inside ${fitLink.name} on the fit map`,
  );
  link.href = `#territory-${fitLink.territory}`;
  return [link];
};

const expandButton = (
  id: string,
  expanded: boolean,
  toggle: (id: string) => void,
): HTMLElement => {
  const button = h("button", "tcard-toggle", expanded ? "Collapse" : "Expand");
  button.type = "button";
  button.setAttribute("aria-expanded", String(expanded));
  if (expanded) {
    button.setAttribute("aria-controls", moreId(id));
  }
  button.addEventListener("click", () => {
    toggle(id);
  });
  return button;
};

/**
 * One territory as a card. Its face is the same for every card, so a row of
 * cards has one height; `expansion` adds the detail below the face and the
 * card then takes the whole row.
 */
export const cardView = (
  card: TerritoryCard,
  expansion: Expansion | null,
  { files, toggle }: CardHandlers,
): HTMLElement => {
  const { id } = card.territory;
  const element = h(
    "article",
    "tcard",
    h("header", "tcard-head", nameView(card), ...badgesOf(card.findings)),
    ...(card.description === ""
      ? []
      : [h("p", "tcard-desc", card.description)]),
    figuresView(card),
    hottestRow(card, files),
    ...partnerRow(card.partner),
    ...findingsView(card.findings),
    ...(expansion === null ? [] : [expansionView(id, card, expansion, files)]),
    h(
      "footer",
      "tcard-foot",
      ...mapLink(card),
      expandButton(id, expansion !== null, toggle),
    ),
  );
  element.id = cardId(id);
  element.dataset["quiet"] = String(card.quiet);
  element.dataset["expanded"] = String(expansion !== null);
  return element;
};
