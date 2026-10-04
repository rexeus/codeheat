import type { Report } from "@codeheat/engine";

import { byId, h } from "../render/dom.js";
import type { FileLinkContext } from "../render/file-link.js";
import { plural } from "../render/format.js";
import { indexTerritories } from "../territories/territory-index.js";
import { collapsedNote, emptyListsNote, matrixNote } from "./empty-notes.js";
import { cliqueCard, familiesCard, pairsCard } from "./list-views.js";
import { matrixOf } from "./matrix-data.js";
import { notComparedNote } from "./matrix-legend.js";
import { renderMatrix } from "./matrix-view.js";
import {
  cliqueViews,
  familyViews,
  filePairViews,
  testOnlyFamilies,
} from "./together-lists.js";

/**
 * Fills the "What changes together" section: the territory matrix, the
 * territories that change as one unit, the file pairs that change together
 * across boundaries, and the copy families. A matrix with fewer than two
 * territories to compare is one sentence, as are the lists when they are all
 * empty, and the whole section when both are; the file lists still work
 * without territories.
 */
export const mountTogether = (
  report: Report,
  context: FileLinkContext,
): void => {
  const { thresholds } = report;
  const index = indexTerritories(report.territories);
  const matrix = matrixOf(index, report.territoryCoupling, thresholds);
  const cliques = cliqueViews(report, index);
  const pairs = filePairViews(report, index);
  const families = familyViews(report);
  const testOnly = testOnlyFamilies(report);
  const lists = {
    cliques: cliques.length,
    pairs: pairs.length,
    families: families.length,
  };
  const note = matrixNote(matrix, thresholds);
  const body = byId("together-body", HTMLElement);
  const collapsed = collapsedNote(note, lists, report.window.couplingCommits);
  const testOnlyNote =
    testOnly === 0
      ? []
      : [
          h(
            "p",
            "tg-note",
            `${plural(testOnly, "family", "families")} of copies in test code only left out.`,
          ),
        ];
  if (collapsed !== null) {
    body.replaceChildren(h("p", "section-empty", collapsed), ...testOnlyNote);
    return;
  }
  const matrixCard = h("section", "tg-card mx-card");
  if (note === null) {
    renderMatrix(matrixCard, matrix, thresholds);
  } else {
    matrixCard.append(
      h("p", "tg-empty", note),
      ...(notComparedNote(matrix) === null
        ? []
        : [h("p", "tg-note", notComparedNote(matrix) ?? "")]),
    );
  }
  const noLists = emptyListsNote(lists, thresholds);
  body.replaceChildren(
    matrixCard,
    noLists === null
      ? h(
          "div",
          "tg-lists",
          cliqueCard(cliques),
          pairsCard(pairs, context, thresholds),
          familiesCard(families, testOnly, context),
        )
      : h("p", "section-empty", noLists),
    ...(noLists === null ? [] : testOnlyNote),
  );
};
