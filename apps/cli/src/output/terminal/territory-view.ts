// Owns the terminal's one line about territories: how many there are at the
// detail the report recommends.
import type { Report } from "@codeheat/engine";

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
