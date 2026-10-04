// Owns focus: answering questions about some files within an unchanged universe.
// Pure over a finished Report, so agents' per-file questions cost no second analysis.
// Patterns are repository-relative picomatch globs or exact paths.
import { Order } from "effect";

import { groupByPath, partnersOf } from "../coupling/partners.js";
import { entryPointsOfFiles } from "../entry-points/entry-points-of.js";
import type { CopyFamily } from "../report/copy-family.js";
import type { EntryPoint } from "../report/entry-point.js";
import type { InspectResult } from "../report/inspect-result.js";
import type { Coupling, FileStats, Report } from "../report/report.js";
import { matchesAny } from "../universe/globs.js";

const MAX_PARTNERS = 10;

type Entry = InspectResult["matches"][number];

/** What an entry says about a file besides the file's own numbers. */
type Standing = {
  readonly universeSize: number;
  /** The couplings of the file. */
  readonly couplings: ReadonlyArray<Coupling>;
  readonly families: ReadonlyArray<CopyFamily>;
  /** The entry points the file belongs to. */
  readonly entryPoints: ReadonlyArray<EntryPoint>;
};

const toEntry = (
  file: FileStats,
  { universeSize, couplings, families, entryPoints }: Standing,
): Entry => ({
  ...file,
  of: universeSize,
  partners: partnersOf(file.path, file.changes, couplings).slice(
    0,
    MAX_PARTNERS,
  ),
  copyFamily: families.find(({ files }) => files.includes(file.path)) ?? null,
  entryPoints,
});

/** The ids of the territories `ids` and the partners of their fit. */
const focusedTerritoriesOf = (
  nodes: Report["territories"]["nodes"],
  ids: ReadonlyArray<string>,
): ReadonlySet<string> => {
  const focused = new Set(ids);
  for (const node of nodes) {
    if (
      focused.has(node.id) &&
      node.fit?.partner !== undefined &&
      node.fit.partner !== null
    ) {
      focused.add(node.fit.partner.territory);
    }
  }
  return focused;
};

/**
 * Reports the files matching `patterns`, each with its rank in the whole
 * universe, its strongest co-change partners, its copy family, and the entry
 * points it belongs to, and the modules and territories they belong to.
 *
 * `report` must be unlimited (as `analyze` returns it); a truncated report
 * would drop matches and partners.
 */
export const inspect = (
  report: Report,
  patterns: ReadonlyArray<string>,
): InspectResult => {
  const focused = new Set<string>();
  const contractFiles = new Set<string>();
  const unmatched: Array<string> = [];
  for (const pattern of patterns) {
    const matches = matchesAny([pattern]);
    const hits = report.files.filter((file) => matches(file.path));
    const contractHits = report.contracts.filter((file) => matches(file.path));
    if (hits.length === 0 && contractHits.length === 0) {
      unmatched.push(pattern);
    }
    for (const { path } of hits) {
      focused.add(path);
    }
    for (const { path } of contractHits) {
      contractFiles.add(path);
    }
  }
  const coupled = groupByPath(report.couplings);
  const matches = report.files
    .filter((file) => focused.has(file.path))
    .toSorted((a, b) => a.rank - b.rank);
  const focusedModules = new Set(matches.map((file) => file.module));
  const entryPoints = entryPointsOfFiles(
    matches,
    report.entryPoints,
    report.territories.nodes,
  );
  const focusedTerritories = focusedTerritoriesOf(
    report.territories.nodes,
    matches.map((file) => file.territory),
  );
  return {
    schemaVersion: 1,
    window: report.window,
    matches: matches.map((file) =>
      toEntry(file, {
        universeSize: report.totals.files,
        couplings: coupled.get(file.path) ?? [],
        families: report.copyFamilies,
        entryPoints: entryPoints.get(file.path) ?? [],
      }),
    ),
    modules: report.modules.filter(({ path }) => focusedModules.has(path)),
    territories: report.territories.nodes.filter(({ id }) =>
      focusedTerritories.has(id),
    ),
    contractFiles: [...contractFiles].toSorted((a, b) => Order.String(a, b)),
    unmatched,
  };
};
