import type { EntryView } from "../entry-points/entry-views.js";
import { byId, h } from "../render/dom.js";
import type { MapLinks } from "../render/file-link.js";
import { entryCard } from "./entry-card.js";

/**
 * Fills the "Where to start" section: the ranked entry points as cards, or a
 * plain note when the report has none.
 */
export const mountStart = (
  entries: readonly EntryView[],
  noEntries: string,
  context: MapLinks,
): void => {
  const body = byId("start-body", HTMLElement);
  if (entries.length === 0) {
    body.replaceChildren(h("p", "section-empty", noEntries));
    return;
  }
  body.replaceChildren(
    h("div", "entries", ...entries.map((entry) => entryCard(entry, context))),
  );
};
