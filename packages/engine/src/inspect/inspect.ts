// Owns focus: answering questions about some files within an unchanged universe.
// Pure over a finished Analysis, so agents' per-file questions cost no second analysis.
// Patterns are repository-relative picomatch globs or exact paths.
import { Order } from "effect";

import { groupByPath, partnersOf } from "../coupling/partners.js";
import { entryPointsOfFiles } from "../entry-points/entry-points-of.js";
import type { Coupling, FileStats, Analysis } from "../model/analysis.js";
import type { CopyFamily } from "../model/copy-family.js";
import type { EntryPoint } from "../model/entry-point.js";
import type { InspectResult } from "../model/inspect-result.js";
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

type Nodes = Analysis["territories"]["nodes"];

/** The ancestors of the `tests` territory `id`, up to and including the nearest one with a fit; none for another kind of territory. */
const ancestorsOfTests = (
  byId: ReadonlyMap<string, Nodes[number]>,
  id: string,
): ReadonlyArray<string> => {
  const chain: Array<string> = [];
  let at = byId.get(id)?.kind === "tests" ? byId.get(id)?.parent : undefined;
  while (at !== undefined && at !== null) {
    chain.push(at);
    at = byId.get(at)?.fit === null ? byId.get(at)?.parent : undefined;
  }
  return chain;
};

/**
 * The ids of the territories `ids`, for each `tests` territory among them
 * (test code has no fit of its own) its ancestors up to the nearest one with a
 * fit, and the partners of their fit.
 */
const focusedTerritoriesOf = (
  nodes: Nodes,
  ids: ReadonlyArray<string>,
): ReadonlySet<string> => {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const focused = new Set([
    ...ids,
    ...ids.flatMap((id) => ancestorsOfTests(byId, id)),
  ]);
  for (const node of nodes) {
    const partner = focused.has(node.id) ? node.fit?.partner : undefined;
    if (partner !== undefined && partner !== null) {
      focused.add(partner.territory);
    }
  }
  return focused;
};

/** The ids of the territories that the entry points of the matched files and their findings are about. */
const namedByEntryPoints = (
  entryPoints: ReadonlyMap<string, ReadonlyArray<EntryPoint>>,
): ReadonlyArray<string> =>
  [...entryPoints.values()].flat().flatMap((entry) => {
    const ids = [entry.territories];
    for (const finding of entry.findings) {
      ids.push(finding.territories);
    }
    return ids.flat();
  });

/** The paths of `list` that `pattern` matches. */
const matched = (
  list: ReadonlyArray<{ readonly path: string }>,
  pattern: string,
): ReadonlyArray<string> => {
  const matches = matchesAny([pattern]);
  return list.flatMap(({ path }) => (matches(path) ? [path] : []));
};

/** The paths of the code files, contract files, and test code each pattern matches, and the patterns that matched none. */
const matchAll = (
  {
    files,
    contracts,
    testCode,
  }: Pick<Analysis, "files" | "contracts" | "testCode">,
  patterns: ReadonlyArray<string>,
) => {
  const hits = patterns.map((pattern) => ({
    pattern,
    files: matched(files, pattern),
    contracts: matched(contracts, pattern),
    tests: matched(testCode, pattern),
  }));
  return {
    focused: new Set(hits.flatMap((hit) => hit.files)),
    contractFiles: new Set(hits.flatMap((hit) => hit.contracts)),
    testCode: new Set(hits.flatMap((hit) => hit.tests)),
    unmatched: hits
      .filter(
        (hit) =>
          hit.files.length + hit.contracts.length + hit.tests.length === 0,
      )
      .map((hit) => hit.pattern),
  };
};

/**
 * Reports the files matching `patterns`, each with its rank in the whole
 * universe, its strongest co-change partners, its copy family, and the entry
 * points it belongs to, and the modules and territories they belong to; the
 * contract files and the test code they match only by path (and test code
 * with its changes), since neither is judged.
 *
 * `report` must be unlimited (as `analyze` returns it); a truncated report
 * would drop matches and partners.
 */
export const inspect = (
  report: Analysis,
  patterns: ReadonlyArray<string>,
): InspectResult => {
  const { focused, contractFiles, testCode, unmatched } = matchAll(
    report,
    patterns,
  );
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
  const focusedTerritories = new Set([
    ...focusedTerritoriesOf(
      report.territories.nodes,
      matches.map((file) => file.territory),
    ),
    ...namedByEntryPoints(entryPoints),
  ]);
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
    testCode: report.testCode.filter(({ path }) => testCode.has(path)),
    unmatched,
  };
};
