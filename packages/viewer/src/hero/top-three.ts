import type { EntryView } from "../entry-points/entry-views.js";
import { TOP_ENTRY_POINTS } from "../entry-points/entry-views.js";
import type { EntryStat } from "../entry-points/evidence.js";
import { breakable, h } from "../render/dom.js";
import { rankBadge } from "../render/rank-badge.js";

/** A number with its words. */
const statView = ({ value, label }: EntryStat): HTMLElement =>
  h("span", "top-stat", h("strong", "", value), ` ${label}`);

/** The first number of the entry, then where its boundary leaks to, or else its second number. */
const statsOf = ({ stats, leaksTo }: EntryView): HTMLElement[] => {
  const [first, second] = stats;
  const next = leaksTo === null ? second : undefined;
  return [
    ...(first === undefined ? [] : [statView(first)]),
    ...(leaksTo === null
      ? []
      : [
          h(
            "span",
            "top-stat top-leak",
            "leaks into ",
            h("strong", "", leaksTo.name),
          ),
        ]),
    ...(next === undefined ? [] : [statView(next)]),
  ];
};

const lineOf = (entry: EntryView): HTMLElement => {
  const link = h(
    "a",
    "top-line",
    rankBadge(entry.rank, null),
    h(
      "span",
      "top-body",
      h(
        "span",
        "top-head",
        h("strong", "top-name", ...breakable(entry.shortHeading)),
        h("span", "chip", entry.kindLabel),
      ),
      h("span", "top-stats", ...statsOf(entry)),
    ),
    h("span", "top-go", "↓"),
  );
  link.href = `#${entry.anchor}`;
  return h("li", "top-item", link);
};

/** The best places to start as one-liners that link down to their cards. */
export const renderTopThree = (
  target: HTMLElement,
  entries: readonly EntryView[],
  noEntries: string,
): void => {
  const top = entries.slice(0, TOP_ENTRY_POINTS);
  target.replaceChildren(
    ...(top.length === 0
      ? [h("li", "top-empty", noEntries)]
      : top.map((entry) => lineOf(entry))),
  );
};
