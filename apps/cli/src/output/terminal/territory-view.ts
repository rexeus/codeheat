// Owns the terminal's one line about territories: how many there are at the
// detail the report recommends.
import type { InspectResult, Analysis } from "@codeheat/engine";

import { escapeForTerminal } from "../escape.js";
import { percent } from "./format.js";

/** Loose files are an area from this share of all the heat on, as the engine judges them. */
const MIN_VISIBLE_HEAT = 0.01;

const isArea = ({
  kind,
  heatShare,
}: Analysis["territories"]["nodes"][number]): boolean =>
  kind === "files" ? heatShare >= MIN_VISIBLE_HEAT : kind !== "other";

/**
 * One line naming the areas, the territories at the recommended detail: how
 * many (buckets of smaller folders and loose files of under 1% of the heat
 * are not counted), and which detail of how
 * many that is. Nothing when the report has no territories.
 */
export const territoryLines = ({
  territories,
}: Pick<Analysis, "territories">): ReadonlyArray<string> => {
  const detail = territories.details.find(
    ({ level }) => level === territories.recommended,
  );
  if (detail === undefined) {
    return [];
  }
  const byId = new Map(territories.nodes.map((node) => [node.id, node]));
  const count = detail.ids.filter((id) => {
    const node = byId.get(id);
    return node !== undefined && isArea(node);
  }).length;
  return [
    `Areas: ${count} at the recommended detail (${territories.recommended} of ${territories.details.length}); --json has every detail.`,
  ];
};

/**
 * The lines for `inspect` on the territory of a file (`territoryId`, one of
 * `territories`): how many of its changes stay inside and the territory it
 * most often changes with. Nothing when the territory is not among
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
