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

/**
 * One line for `inspect` on the territory of a file (`territoryId`, one of
 * `territories`): how many of its changes stay inside and the territory it
 * most often changes with. Nothing when the territory is not among them.
 */
export const fileTerritoryLine = (
  territories: InspectResult["territories"],
  territoryId: string,
): ReadonlyArray<string> => {
  const node = territories.find(({ id }) => id === territoryId);
  if (node === undefined) {
    return [];
  }
  const name = `territory ${escapeForTerminal(node.path)}`;
  const { fit } = node;
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
