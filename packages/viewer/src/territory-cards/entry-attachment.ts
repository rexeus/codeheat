// Owns which places to start belong on which territory card at one detail:
// the ones that concern the card's territory, a part of it, or the territory
// it is a part of.
import type { FileStats, Report } from "@codeheat/engine";

import type { EntryView } from "../entry-points/entry-views.js";
import { territoryName } from "../territories/territory-index.js";
import type { Territory } from "../territories/territory-index.js";
import type { Concerning } from "./findings.js";
import type { LevelIndex } from "./level-index.js";

/** A place to start with the nodes of the territory tree it concerns, at any detail. */
export type AttachableEntry = {
  readonly view: EntryView;
  /** The `id`s of the finest territories the entry names, and of those that hold the files it names. */
  readonly nodes: readonly string[];
};

/**
 * Pairs each place to start with the nodes of the tree it concerns: the raw
 * `territories` of the entry point (not the ones lifted to the recommended
 * detail, which a finer detail does not show), and the finest territory of
 * every file it or its findings name. `views` are in the report's order.
 */
export const attachableEntries = (
  report: Report,
  views: readonly EntryView[],
  files: ReadonlyMap<string, FileStats>,
): AttachableEntry[] =>
  views.map((view) => {
    const point = report.entryPoints.find(({ rank }) => rank === view.rank);
    const named = [
      ...(point?.files ?? []),
      ...(point?.findings.flatMap((finding) => finding.files) ?? []),
    ];
    const held = named.flatMap((path) => files.get(path)?.territory ?? []);
    return {
      view,
      nodes: [...new Set([...(point?.territories ?? []), ...held])],
    };
  });

const ancestorsOf = (
  territory: Territory,
  byId: ReadonlyMap<string, Territory>,
): Set<string> => {
  const ancestors = new Set<string>();
  let parent = territory.parent;
  while (parent !== null && !ancestors.has(parent)) {
    ancestors.add(parent);
    parent = byId.get(parent)?.parent ?? null;
  }
  return ancestors;
};

/** The names of the nodes `ids`, each with the path of `base` taken off its front when it lies beneath it. */
const namesOf = (
  ids: readonly string[],
  byId: ReadonlyMap<string, Territory>,
  base = "",
): string =>
  ids
    .flatMap((id) => byId.get(id) ?? [])
    .map((node) => territoryName(node))
    .map((name) =>
      base !== "" && name.startsWith(`${base}/`)
        ? name.slice(base.length + 1)
        : name,
    )
    .join(", ");

/**
 * The places to start that belong on the card of `territory` at `level`, in
 * the order given. An entry belongs when it names the territory itself, a part
 * of it (a node the territory holds at this detail), or a territory it is a
 * part of. `where` then says which: nothing for the territory itself, `in a, b`
 * naming every part of it (by the path beneath the territory's own), `within x`
 * naming the territory it is a part of.
 */
export const concerningOf = (
  territory: Territory,
  level: LevelIndex,
  byId: ReadonlyMap<string, Territory>,
  entries: readonly AttachableEntry[],
): Concerning[] => {
  const ancestors = ancestorsOf(territory, byId);
  return entries.flatMap(({ view, nodes }) => {
    const itself = nodes.includes(territory.id);
    const parts = nodes.filter(
      (id) => id !== territory.id && level.ownerOf(id) === territory.id,
    );
    const containing = nodes.filter((id) => ancestors.has(id));
    const where = [
      ...(parts.length === 0
        ? []
        : [`in ${namesOf(parts, byId, territoryName(territory))}`]),
      ...(containing.length === 0
        ? []
        : [`within ${namesOf(containing, byId)}`]),
    ].join("; ");
    return itself || where !== ""
      ? [{ entry: view, where: itself ? "" : where, itself }]
      : [];
  });
};
