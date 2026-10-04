import { territoryNameParts } from "./territory-index.js";
import type { NameParts, Territory } from "./territory-index.js";

/** `parts` with the last `depth` folders of its directory moved in front of its name. */
const qualified = ({ dir, base }: NameParts, depth: number): NameParts => {
  const folders = dir.split("/").filter((folder) => folder !== "");
  const kept = folders.length - Math.min(depth, folders.length);
  return {
    dir: kept === 0 ? "" : `${folders.slice(0, kept).join("/")}/`,
    base: [...folders.slice(kept), base].join("/"),
  };
};

const hasDuplicates = (names: readonly string[]): boolean =>
  new Set(names).size < names.length;

/** The smallest number of parent folders that tells the members of one group of equal names apart; the deepest folder count when nothing does. */
const depthToTellApart = (group: readonly NameParts[]): number => {
  const deepest = Math.max(
    ...group.map(({ dir }) => dir.split("/").filter(Boolean).length),
  );
  for (let depth = 1; depth < deepest; depth += 1) {
    if (!hasDuplicates(group.map((parts) => qualified(parts, depth).base))) {
      return depth;
    }
  }
  return deepest;
};

/**
 * How to display the names of `territories` shown side by side. A name that
 * two of them share (`scripts` and `adev/scripts` both end in `scripts`, which
 * is all a narrow tile shows) is shown with as many of its parent folders as it
 * takes to tell the territories apart; every other name is shown as
 * `territoryNameParts` splits it. The lookup is for the territories given.
 */
export const distinctNameParts = (
  territories: readonly Territory[],
): ((territory: Territory) => NameParts) => {
  const parts = new Map(
    territories.map((territory) => [
      territory.id,
      territoryNameParts(territory),
    ]),
  );
  const groups = new Map<string, (readonly [string, NameParts])[]>();
  for (const entry of parts) {
    const [, { base }] = entry;
    groups.set(base, [...(groups.get(base) ?? []), entry]);
  }
  const shown = new Map<string, NameParts>();
  for (const members of groups.values()) {
    const depth =
      members.length > 1
        ? depthToTellApart(members.map(([, memberParts]) => memberParts))
        : 0;
    for (const [id, memberParts] of members) {
      shown.set(id, depth === 0 ? memberParts : qualified(memberParts, depth));
    }
  }
  return (territory) =>
    shown.get(territory.id) ?? territoryNameParts(territory);
};
