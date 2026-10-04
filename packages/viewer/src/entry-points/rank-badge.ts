import { h } from "../render/dom.js";
import { TOP_ENTRY_POINTS } from "./entry-views.js";

/** The number of a place to start: the top places drawn filled, the rest outlined. */
export const rankBadge = (rank: number): HTMLElement => {
  const badge = h("span", "rank-badge", String(rank));
  badge.dataset["top"] = String(rank <= TOP_ENTRY_POINTS);
  return badge;
};
