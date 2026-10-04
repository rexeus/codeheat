import { h } from "../render/dom.js";
import type { Verdict, VerdictLevel } from "../verdict/derive-verdict.js";

/** A glyph beside the level's name, so the level never rests on color alone. */
const GLYPHS: Record<VerdictLevel, string> = {
  holds: "✓",
  mixed: "◐",
  strained: "!",
  unknown: "?",
};

const factView = ({ value, label, note }: Verdict["facts"][number]) =>
  h(
    "li",
    "fact",
    h("strong", "fact-value", value),
    h("span", "fact-label", label),
    ...(note === "" ? [] : [h("small", "fact-note", note)]),
  );

/** Fills `target` with the verdict's level, its sentence, and the numbers behind it. */
export const renderVerdict = (target: HTMLElement, verdict: Verdict): void => {
  target.dataset["level"] = verdict.level;
  target.replaceChildren(
    h(
      "p",
      "verdict-level",
      h("span", "verdict-glyph", GLYPHS[verdict.level]),
      verdict.label,
    ),
    h("p", "verdict-sentence", verdict.sentence),
    h("ul", "facts", ...verdict.facts.map(factView)),
  );
};
