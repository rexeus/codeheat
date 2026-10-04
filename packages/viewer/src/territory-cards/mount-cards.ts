import type { Report } from "@codeheat/engine";

import { byId, h } from "../render/dom.js";
import type { MapLinks } from "../render/file-link.js";
import { formatCount, formatShare } from "../render/format.js";
import { cardsOf } from "./card-model.js";
import type { CardSource, TerritoryCard } from "./card-model.js";
import { cardId, cardView } from "./card-view.js";
import {
  initialState,
  selectDetail,
  showAllCards,
  shownCards,
  toggleExpanded,
} from "./cards-state.js";
import type { CardsState } from "./cards-state.js";
import { levelChoicesOf } from "./detail-levels.js";
import type { LevelChoice } from "./detail-levels.js";
import { detailSlider } from "./detail-slider.js";
import type { DetailSlider } from "./detail-slider.js";
import { expansionOf } from "./expansion.js";
import { indexLevel } from "./level-index.js";
import type { LevelIndex } from "./level-index.js";

/** What the section says when the report has no territories. */
const NO_TERRITORIES =
  "This report has no territories, so there are no areas to show; analyze again with a current codeheat.";

const EXPLANATION =
  "Detail 1 is the coarsest cut, by packages or top-level folders; each further detail splits the territories that are too big or whose folders change independently. The recommended detail is the one the map above shows.";

type SectionInput = {
  readonly source: CardSource;
  readonly territories: Report["territories"];
  readonly files: MapLinks;
  readonly choices: readonly LevelChoice[];
  readonly recommended: number;
};

type Level = {
  readonly index: LevelIndex;
  readonly cards: readonly TerritoryCard[];
};

const summaryOf = (
  level: number,
  last: number,
  cards: readonly TerritoryCard[],
): string => {
  const real = cards.filter(({ quiet }) => !quiet).length;
  const rest = cards.length - real;
  const territories = real === 1 ? "territory" : "territories";
  const quieter =
    rest === 0
      ? ""
      : `, then ${formatCount(rest)} of test code or leftovers, quieter`;
  return `Detail ${level} of ${last}: ${formatCount(real)} ${territories}${quieter}.`;
};

/**
 * The section's one piece of state and the elements it redraws. Switching the
 * detail redraws the cards; expanding a card redraws only that card, so the
 * reader's place and focus stay.
 */
class CardsSection {
  private readonly input: SectionInput;
  private state: CardsState;
  private readonly levels = new Map<number, Level>();
  private readonly slider: DetailSlider;
  private readonly grid = h("div", "tcards");
  private readonly status = h("p", "heat-status");
  private readonly reset = h(
    "button",
    "heat-reset",
    "Back to the recommended detail",
  );
  private readonly more = h("button", "heat-more");

  constructor(input: SectionInput) {
    const { choices, recommended } = input;
    this.input = input;
    this.state = initialState(recommended);
    this.slider = detailSlider(choices, recommended, (level) => {
      this.chooseDetail(level);
    });
    this.status.setAttribute("aria-live", "polite");
    this.reset.type = "button";
    this.more.type = "button";
    this.reset.addEventListener("click", () => {
      this.chooseDetail(recommended);
      // The button hides itself; the slider is where the reader goes on from.
      this.slider.element.querySelector("input")?.focus();
    });
    this.more.addEventListener("click", () => {
      this.showAll();
    });
  }

  mount(body: HTMLElement): void {
    body.replaceChildren(
      h(
        "div",
        "heat-controls",
        this.slider.element,
        h("p", "heat-explanation", EXPLANATION, this.reset),
      ),
      this.status,
      this.grid,
      h("div", "heat-more-row", this.more),
    );
    this.render();
  }

  private levelAt(level: number): Level {
    const known = this.levels.get(level);
    if (known !== undefined) {
      return known;
    }
    const index = indexLevel(
      this.input.territories,
      this.input.source.files,
      level,
    );
    const made = { index, cards: cardsOf(this.input.source, index) };
    this.levels.set(level, made);
    return made;
  }

  /** Shows the rest of the cards and moves focus to the first of them, since the button that had it is gone. */
  private showAll(): void {
    const { cards } = this.levelAt(this.state.detail);
    const shownBefore = shownCards(cards, this.state).cards.length;
    this.state = showAllCards(this.state);
    this.render();
    this.grid.children[shownBefore]
      ?.querySelector<HTMLElement>(".tcard-toggle")
      ?.focus();
  }

  private chooseDetail(level: number): void {
    this.state = selectDetail(
      this.state,
      level,
      this.input.choices.map((choice) => choice.level),
    );
    this.render();
  }

  private draw(card: TerritoryCard): HTMLElement {
    const { index, cards } = this.levelAt(this.state.detail);
    const { id } = card.territory;
    const expansion = this.state.expanded.has(id)
      ? expansionOf(card, cards, index, this.input.source)
      : null;
    return cardView(card, expansion, {
      files: this.input.files,
      toggle: (toggled) => {
        this.toggle(toggled);
      },
    });
  }

  private toggle(id: string): void {
    this.state = toggleExpanded(this.state, id);
    const current = this.grid.querySelector(`#${cardId(id)}`);
    const card = this.levelAt(this.state.detail).cards.find(
      ({ territory }) => territory.id === id,
    );
    if (current !== null && card !== undefined) {
      const next = this.draw(card);
      current.replaceWith(next);
      next.querySelector<HTMLElement>(".tcard-toggle")?.focus();
    }
  }

  private render(): void {
    const { detail } = this.state;
    const { cards } = this.levelAt(detail);
    const {
      cards: visible,
      hidden,
      hiddenHeat,
    } = shownCards(cards, this.state);
    this.slider.show(detail);
    this.status.textContent = summaryOf(
      detail,
      this.input.choices.at(-1)?.level ?? detail,
      cards,
    );
    this.reset.hidden = detail === this.input.recommended;
    this.grid.replaceChildren(...visible.map((card) => this.draw(card)));
    this.more.hidden = hidden === 0;
    this.more.textContent = `Show the other ${formatCount(hidden)} (${formatShare(hiddenHeat)} of the effort)`;
  }
}

/**
 * Fills "Where the heat is": the detail slider and one card per territory at
 * the chosen detail, hottest first, at the recommended detail to begin with.
 */
export const mountCards = (
  source: CardSource,
  { territories }: Pick<Report, "territories">,
  files: MapLinks,
): void => {
  const body = byId("heat-body", HTMLElement);
  const choices = levelChoicesOf(territories);
  const recommended = choices.find((choice) => choice.recommended);
  if (recommended === undefined) {
    body.replaceChildren(h("p", "section-empty", NO_TERRITORIES));
    return;
  }
  new CardsSection({
    source,
    territories,
    files,
    choices,
    recommended: recommended.level,
  }).mount(body);
};
