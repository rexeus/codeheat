import type { Report } from "@codeheat/engine";

import { byId, h } from "../render/dom.js";
import type { FileLinkContext } from "../render/file-link.js";
import { indexTerritories } from "../territories/territory-index.js";
import { cliqueCard, familiesCard, pairsCard } from "./list-views.js";
import { matrixOf } from "./matrix-data.js";
import { renderMatrix } from "./matrix-view.js";
import {
  cliqueViews,
  familyViews,
  filePairViews,
  testOnlyFamilies,
} from "./together-lists.js";

/** What the matrix area says when the report has no territories to compare. */
const NO_TERRITORIES =
  "This report has no territories, so there is no matrix of how they change together; analyze again with a current codeheat.";

/**
 * Fills the "What changes together" section: the territory matrix, the
 * territories that change as one unit, the file pairs that change together
 * across boundaries, and the copy families. Without territories the matrix
 * and the cliques say so; the file lists still work.
 */
export const mountTogether = (
  report: Report,
  context: FileLinkContext,
): void => {
  const index = indexTerritories(report.territories);
  const matrix = matrixOf(index, report.territoryCoupling, report.thresholds);
  const body = byId("together-body", HTMLElement);
  const matrixCard = h("section", "tg-card mx-card");
  if (matrix.rows.length === 0) {
    matrixCard.append(h("p", "tg-empty", NO_TERRITORIES));
  } else {
    renderMatrix(matrixCard, matrix, report.thresholds);
  }
  body.replaceChildren(
    matrixCard,
    h(
      "div",
      "tg-lists",
      cliqueCard(cliqueViews(report, index)),
      pairsCard(filePairViews(report, index), context),
      familiesCard(familyViews(report), testOnlyFamilies(report), context),
    ),
  );
};
