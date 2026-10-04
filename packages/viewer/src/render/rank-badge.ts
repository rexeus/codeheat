import { TOP_ENTRY_POINTS } from "../verdict/facts.js";
import { h } from "./dom.js";

/**
 * The number of a place to start. It links to the entry's card (`href`) or,
 * where the card is already in view, only marks it; the first three are
 * drawn filled, the rest outlined.
 */
export const rankBadge = (rank: number, href: string | null): HTMLElement => {
  const label = String(rank);
  const badge =
    href === null
      ? h("span", "rank-badge", label)
      : h("a", "rank-badge", label);
  badge.dataset["top"] = String(rank <= TOP_ENTRY_POINTS);
  if (badge instanceof HTMLAnchorElement && href !== null) {
    badge.href = href;
    badge.setAttribute("aria-label", `Place to start ${rank}`);
  }
  return badge;
};
