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
  /** For each further finding of the entry (`view.also`), the `id`s of the finest territories it names and of those that hold its files. */
  readonly alsoNodes: ReadonlyArray<readonly string[]>;
};

const unique = (ids: readonly string[]): string[] => [...new Set(ids)];

/** The finest territory of each of `paths` that the report lists. */
const heldBy = (
  paths: readonly string[],
  files: ReadonlyMap<string, FileStats>,
): string[] => paths.flatMap((path) => files.get(path)?.territory ?? []);

/**
 * Pairs each place to start with the nodes of the tree it concerns: the raw
 * `territories` of the entry point (not the ones lifted to the recommended
 * detail, which a finer detail does not show), and the finest territory of
 * every file it or its findings name; and for each further finding, the nodes
 * of that finding. `views` are in the report's order.
 */
export const attachableEntries = (
  report: Report,
  views: readonly EntryView[],
  files: ReadonlyMap<string, FileStats>,
): AttachableEntry[] =>
  views.map((view) => {
    const point = report.entryPoints.find(({ rank }) => rank === view.rank);
    const findings = point?.findings ?? [];
    const named = [
      ...(point?.files ?? []),
      ...findings.flatMap((finding) => finding.files),
    ];
    return {
      view,
      nodes: unique([...(point?.territories ?? []), ...heldBy(named, files)]),
      alsoNodes: findings
        .slice(1)
        .map((finding) =>
          unique([...finding.territories, ...heldBy(finding.files, files)]),
        ),
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

/** How the card's territory relates to `ids`: it is one of them, holds some of them, or is part of some of them. */
const relationTo = (
  territory: Territory,
  level: LevelIndex,
  byId: ReadonlyMap<string, Territory>,
  ids: readonly string[],
): { itself: boolean; where: string } => {
  const ancestors = ancestorsOf(territory, byId);
  const parts = ids.filter(
    (id) => id !== territory.id && level.ownerOf(id) === territory.id,
  );
  const containing = ids.filter((id) => ancestors.has(id));
  const where = [
    ...(parts.length === 0
      ? []
      : [`in ${namesOf(parts, byId, territoryName(territory))}`]),
    ...(containing.length === 0 ? [] : [`within ${namesOf(containing, byId)}`]),
  ].join("; ");
  return { itself: ids.includes(territory.id), where };
};

/** Whether the card's territory is one of `ids`, holds some of them, or is part of some of them; `where` says which part or whole. */
const concerns = (relation: { itself: boolean; where: string }): boolean =>
  relation.itself || relation.where !== "";

/**
 * The places to start that belong on the card of `territory` at `level`, in
 * the order given. An entry belongs when its primary finding names the
 * territory itself, a part of it (a node the territory holds at this detail),
 * or a territory it is a part of, or when a further finding does. `where` then
 * says which: nothing for the territory itself, `in a, b` naming every part of
 * it (by the path beneath the territory's own), `within x` naming the
 * territory it is a part of. Of the further findings only those that concern
 * the territory in the same way belong (`also`): the boundary of one of the
 * two territories of a boundary between them is not on the card of the other,
 * nor on that of a territory that holds neither. A territory that only a
 * further finding names (a clique that a boundary between two territories took
 * in) gets that finding without the entry's primary one (`primary` is false).
 */
export const concerningOf = (
  territory: Territory,
  level: LevelIndex,
  byId: ReadonlyMap<string, Territory>,
  entries: readonly AttachableEntry[],
): Concerning[] =>
  entries.flatMap(({ view, nodes, alsoNodes }): Concerning[] => {
    const own = relationTo(territory, level, byId, nodes);
    const related = view.also.flatMap((finding, index) => {
      const relation = relationTo(
        territory,
        level,
        byId,
        alsoNodes[index] ?? [],
      );
      return concerns(relation) ? [{ finding, relation }] : [];
    });
    const primary = concerns(own);
    const lead = primary ? own : related[0]?.relation;
    return lead === undefined
      ? []
      : [
          {
            entry: view,
            where: lead.itself ? "" : lead.where,
            itself: lead.itself,
            primary,
            also: related.map(({ finding }) => finding),
          },
        ];
  });
