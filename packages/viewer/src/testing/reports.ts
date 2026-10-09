import type { Coupling, FileStats, Module, Analysis } from "@codeheat/engine";

type Territory = Analysis["territories"]["nodes"][number];
type TerritoryFit = NonNullable<Territory["fit"]>;
type EntryPoint = Analysis["entryPoints"][number];

/** A file with the given path; every metric can be overridden. */
export const fileStats = (
  path: string,
  overrides: Partial<FileStats> = {},
): FileStats => ({
  path,
  test: false,
  rank: 1,
  score: 0.5,
  revisions: 10,
  changes: 10,
  linesAdded: 100,
  linesDeleted: 20,
  breadth: 3,
  module: ".",
  territory: "t1",
  loc: 100,
  complexity: { total: 200, mean: 2, max: 5 },
  reasons: [],
  trend: null,
  heat: null,
  ...overrides,
});

export const coupling = (
  a: string,
  b: string,
  overrides: Partial<Coupling> = {},
): Coupling => ({
  a,
  b,
  sharedCommits: 5,
  degree: 0.5,
  distance: 0,
  testPair: false,
  kinds: { a: "code", b: "code" },
  crossesModule: false,
  imports: null,
  ...overrides,
});

/** A package module with the given path; every measure can be overridden. */
export const moduleStats = (
  path: string,
  overrides: Partial<Module> = {},
): Module => ({
  path,
  kind: "package",
  files: 2,
  testOnly: false,
  commits: 10,
  localCommits: 6,
  cohesion: 0.6,
  radius: 1,
  partners: [],
  entryPoints: [],
  interfaceCommits: 0,
  implementationCommits: 10,
  leakage: null,
  leakyInterface: false,
  depth: null,
  trend: null,
  erosion: null,
  fixDensity: null,
  ...overrides,
});

/** The fit of a territory that contains 60 % of its changes; every measure can be overridden. */
export const territoryFit = (
  overrides: Partial<TerritoryFit> = {},
): TerritoryFit => ({
  detail: 1,
  containment: 0.6,
  radius: 2,
  partner: null,
  distantPairs: 0,
  hiddenPairs: 0,
  cliques: 0,
  erosion: null,
  chronicFiles: 0,
  acuteFiles: 0,
  chronicShare: 0,
  fixDensity: null,
  ...overrides,
});

/** A folder territory with the given id and path, no children and a fit; every field can be overridden. */
export const territoryNode = (
  id: string,
  path: string,
  overrides: Partial<Territory> = {},
): Territory => ({
  id,
  path,
  kind: "folder",
  parent: null,
  children: [],
  files: 10,
  changes: 20,
  heatShare: 0.1,
  description: `main files: ${path}`,
  splitReason: null,
  fit: territoryFit(),
  ...overrides,
});

/** A boundary entry point of the given rank; every field can be overridden. */
export const entryPointOf = (
  rank: number,
  overrides: Partial<EntryPoint> = {},
): EntryPoint => ({
  rank,
  kind: "boundary",
  score: 0.1,
  territories: [],
  files: [],
  evidence: {},
  verdict: "The boundary does not hold.",
  designMove:
    "Move a boundary: bring what changes together into one territory.",
  findings: [],
  ...overrides,
});

const THRESHOLDS: Analysis["thresholds"] = {
  maxCommitFiles: 50,
  hubMinBreadth: 10,
  hubMinRevisions: 5,
  hubTopShare: 0.05,
  minModuleCommits: 5,
  minVolatilityRatio: 2,
  minInterfaceChanges: 5,
  minFanIn: 5,
  minCliqueShare: 0.3,
  minLocalDistance: 3,
  minHiddenProbability: 0.5,
  minCopySimilarity: 0.5,
  minLeakage: 0.5,
  minImplementationCommits: 5,
  minSharedCommits: 3,
  minDegree: 0.3,
  propagationDepth: 3,
  ubiquitousShare: 0.3,
  ubiquitousMinCommits: 10,
  minWindowChanges: 10,
  minTrendWindows: 3,
  minErosionShift: 0.1,
  minErosionSigmas: 2,
  minVerdictWindows: 5,
  hotTopShare: 0.1,
  minConventionShare: 0.05,
  minEntryHeatShare: 0.02,
  maxEntryContainment: 0.75,
  minEntryChronicShare: 0.5,
  minEntryChanges: 3,
  minEntryCouplingChanges: 5,
  minEntryScore: 0.005,
  maxEntriesPerKind: 6,
  maxEntries: 10,
  maxCoupledTerritories: 24,
  minVerdictCoverage: 0.5,
  minMixedLeakShare: 0.2,
  minStrainedLeakShare: 0.5,
  thinBelowChanges: 100,
  thinBelowAreas: 3,
  maxMeanLineLength: 300,
  maxFileBytes: 1048576,
};

/** The design-fit lists of a report, all empty. */
const NO_FINDINGS = {
  verdict: {
    level: "unknown",
    reason: "no-territories",
    leakShare: 0,
    coverage: 0,
    judged: [],
    leaking: [],
    eroding: false,
    trend: "unknown",
  },
  changeRadius: null,
  propagationCost: null,
  series: [],
  seriesSince: null,
  erosion: null,
  fixDensity: {
    changes: 0,
    fixes: 0,
    conventional: 0,
    known: false,
    share: null,
  },
  cliquesPartial: false,
  dependencyDirection: [],
  unstableInterfaces: [],
  cliques: [],
  moduleCoupling: [],
  distantCouplings: [],
  territories: { recommended: 0, details: [], nodes: [] },
  territoryCoupling: [],
  territoryCliques: [],
  entryPoints: [],
} satisfies Partial<Analysis>;

/** A minimal valid report around the given files, couplings, and modules; `overrides` replace any other field (`comparison` is null by default). */
export const reportOf = (
  files: readonly FileStats[],
  couplings: readonly Coupling[] = [],
  modules: readonly Module[] = [],
  overrides: Partial<Analysis> = {},
): Analysis => ({
  schemaVersion: 1,
  tool: { name: "codeheat", version: "0.0.0" },
  generatedAt: "2026-09-29T12:00:00.000Z",
  repository: { name: "acme", head: null, scope: ".", shallow: false },
  window: {
    since: "2025-09-29T12:00:00.000Z",
    until: "2026-09-29T12:00:00.000Z",
    commits: 12,
    realCommits: 12,
    couplingCommits: 10,
    lastCommitAt: null,
  },
  mechanicalCommits: {
    ignored: 0,
    renames: 0,
    whitespace: 0,
    reverts: 0,
    duplicates: 0,
  },
  logicalChanges: { by: "commit", count: 0, largest: 0 },
  comparison: null,
  thresholds: THRESHOLDS,
  totals: {
    files: files.length,
    testCode: 0,
    contracts: 0,
    couplings: couplings.length,
    modules: modules.length,
    generated: 0,
  },
  files,
  testCode: [],
  contracts: [],
  ubiquitousFiles: [],
  couplings,
  modules,
  copyFamilies: [],
  ...NO_FINDINGS,
  ...overrides,
});
