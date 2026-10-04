import { h } from "../render/dom.js";
import type { LevelChoice } from "./detail-levels.js";

/** The slider, and a way to move it from outside. */
export type DetailSlider = {
  readonly element: HTMLElement;
  /** Shows `level` as chosen, without telling `onChange`. */
  readonly show: (level: number) => void;
};

const RANGE_ID = "detail-range";

/** What assistive technology reads for a position of the slider. */
const valueText = ({ level, territories, recommended }: LevelChoice): string =>
  `Detail ${level}, ${territories} ${territories === 1 ? "territory" : "territories"}${recommended ? ", recommended" : ""}`;

const tickView = (
  choice: LevelChoice,
  index: number,
  count: number,
  choose: (level: number) => void,
): HTMLElement => {
  const tick = h(
    "button",
    "detail-tick",
    h("strong", "", h("span", "detail-word", "Detail "), String(choice.level)),
    h("span", "", String(choice.territories)),
    ...(choice.recommended
      ? [h("span", "detail-recommended", "recommended")]
      : []),
  );
  tick.type = "button";
  // The slider is the keyboard's way in; the ticks are for the pointer.
  tick.tabIndex = -1;
  tick.setAttribute("aria-hidden", "true");
  tick.style.setProperty("--at", String(index / (count - 1)));
  tick.addEventListener("click", () => {
    choose(choice.level);
  });
  return tick;
};

/** The range input over `choices`, and how to move it from outside. */
const rangeOf = (
  choices: readonly LevelChoice[],
  onChange: (level: number) => void,
): { range: HTMLInputElement; show: (level: number) => void } => {
  const first = choices[0]?.level ?? 1;
  const range = h("input", "detail-range");
  range.id = RANGE_ID;
  range.type = "range";
  range.min = String(first);
  range.max = String(choices.at(-1)?.level ?? first);
  range.step = "1";
  const show = (level: number): void => {
    range.value = String(level);
    const choice = choices.find((candidate) => candidate.level === level);
    if (choice !== undefined) {
      range.setAttribute("aria-valuetext", valueText(choice));
    }
  };
  range.addEventListener("input", () => {
    show(Number(range.value));
    onChange(Number(range.value));
  });
  return { range, show };
};

/**
 * The detail slider over `choices`, coarsest first, with the recommended level
 * marked. `onChange` gets the chosen level, from the slider's keys, a drag,
 * or a click on a label. A single choice has nothing to slide.
 */
export const detailSlider = (
  choices: readonly LevelChoice[],
  selected: number,
  onChange: (level: number) => void,
): DetailSlider => {
  if (choices.length < 2) {
    return {
      element: h(
        "div",
        "detail",
        h("span", "detail-label", "Detail"),
        h("p", "detail-only", "This repository has only one detail."),
      ),
      show: () => undefined,
    };
  }
  const { range, show } = rangeOf(choices, onChange);
  const choose = (level: number): void => {
    show(level);
    onChange(level);
  };
  show(selected);
  const label = h("label", "detail-label", "Detail");
  label.htmlFor = RANGE_ID;
  return {
    element: h(
      "div",
      "detail",
      label,
      h(
        "div",
        "detail-track",
        range,
        h(
          "div",
          "detail-ticks",
          ...choices.map((choice, index) =>
            tickView(choice, index, choices.length, choose),
          ),
        ),
      ),
    ),
    show,
  };
};
