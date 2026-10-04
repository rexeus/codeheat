// Owns the terminal's one line about territories: how many there are at the
// detail the report recommends.
import type { InspectResult, Report } from "@codeheat/engine";

import { escapeForTerminal } from "../escape.js";
import { percent } from "./format.js";

const isTerritory = (kind: string): boolean =>
  kind === "package" || kind === "folder" || kind === "group";

/**
 * One line naming the territories at the recommended detail: how many (buckets
 * of smaller folders, loose files, and test-only code are not counted), and
 * which detail of how many that is. Nothing when the report has no territories.
 */
export const territoryLines = ({
  territories,
}: Pick<Report, "territories">): ReadonlyArray<string> => {
  const detail = territories.details.find(
    ({ level }) => level === territories.recommended,
  );
  if (detail === undefined) {
    return [];
  }
  const kinds = new Map(territories.nodes.map(({ id, kind }) => [id, kind]));
  const count = detail.ids.filter((id) =>
    isTerritory(kinds.get(id) ?? ""),
  ).length;
  return [
    `Territories: ${count} at the recommended detail (${territories.recommended} of ${territories.details.length}); --json has every detail.`,
  ];
};

/** The nearest ancestor of `node` among `territories` that has a fit. */
const ancestorWithFit = (
  territories: InspectResult["territories"],
  node: InspectResult["territories"][number],
): InspectResult["territories"][number] | undefined => {
  const parent = territories.find(({ id }) => id === node.parent);
  if (parent === undefined || parent.fit !== null) {
    return parent;
  }
  return ancestorWithFit(territories, parent);
};

/**
 * The lines for `inspect` on the territory of a file (`territoryId`, one of
 * `territories`): how many of its changes stay inside and the territory it
 * most often changes with. For a file in a `tests` territory, which has no fit,
 * the number of changes of the test code and the line of the nearest territory
 * above it that has a fit. Nothing when the territory is not among
 * `territories`.
 */
export const fileTerritoryLine = (
  territories: InspectResult["territories"],
  territoryId: string,
): ReadonlyArray<string> => {
  const node = territories.find(({ id }) => id === territoryId);
  if (node === undefined) {
    return [];
  }
  if (node.changes === 0) {
    return [`territory ${escapeForTerminal(node.path)}: no counted changes`];
  }
  if (node.kind === "tests") {
    const parent = territories.find(({ id }) => id === node.parent);
    const above = ancestorWithFit(territories, node);
    return [
      `test code of ${escapeForTerminal(parent?.path ?? node.path)}: ${node.changes} changes`,
      ...(above === undefined ? [] : fileTerritoryLine(territories, above.id)),
    ];
  }
  const { fit } = node;
  const name = `territory ${escapeForTerminal(node.path)}`;
  if (fit === null || fit.containment === null) {
    return [`${name}: no counted changes`];
  }
  const partner = territories.find(({ id }) => id === fit.partner?.territory);
  const note =
    fit.partner === null || partner === undefined
      ? ""
      : `, most often with ${escapeForTerminal(partner.path)} (${fit.partner.sharedChanges})`;
  return [
    `${name}: ${percent(fit.containment)} of ${node.changes} changes stay inside${note}`,
  ];
};
