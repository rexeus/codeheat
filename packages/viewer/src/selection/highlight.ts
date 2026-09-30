import type { PathMatcher } from "./filter.js";
import type { Partner, PartnerIndex } from "./partners.js";

/** The selected file and how strongly its partners are coupled to it. */
export type Selection = {
  readonly path: string;
  readonly partners: ReadonlyMap<string, Partner>;
};

/** Selects `path`; partners keep the strongest-first order of the index. */
export const selectionOf = (path: string, index: PartnerIndex): Selection => ({
  path,
  partners: new Map(
    (index.get(path) ?? []).map((partner) => [partner.path, partner]),
  ),
});

/** How a tile is drawn relative to the current selection and filter. */
export type Highlight = "selected" | "partner" | "match" | "dimmed" | "none";

/**
 * Decides a tile's highlight. A selection outranks the filter: while a file is
 * selected, only it and its partners stay lit. `path` is `null` for tiles that
 * stand for several files and can be neither selected nor partners.
 */
export const highlightOf = (
  path: string | null,
  selection: Selection | null,
  matcher: PathMatcher | null,
): Highlight => {
  if (selection !== null) {
    if (path === selection.path) {
      return "selected";
    }
    return path !== null && selection.partners.has(path) ? "partner" : "dimmed";
  }
  if (matcher === null) {
    return "none";
  }
  return path !== null && matcher(path) ? "match" : "dimmed";
};
