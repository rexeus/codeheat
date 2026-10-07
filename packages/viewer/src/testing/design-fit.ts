import type { Analysis } from "@codeheat/engine";

import {
  entryPointOf,
  fileStats,
  reportOf,
  territoryFit,
  territoryNode,
} from "./reports.js";

type Territory = Analysis["territories"]["nodes"][number];

/** A territory at the recommended detail, as `{ id, path, heat, containment }`, with the kind `folder` unless overridden. */
export type PartSpec = {
  readonly id: string;
  readonly path: string;
  readonly heat: number;
  readonly containment: number | null;
  readonly kind?: Territory["kind"];
  readonly description?: string;
  /** Counted changes that touched it; 20 unless given. */
  readonly changes?: number;
  /** The territory it changes with most, as `{ territory, sharedChanges, share }`; one that is not in the report unless given, `null` for none. */
  readonly partner?: NonNullable<Territory["fit"]>["partner"];
  /** How the engine judged it for the verdict; not judged unless given. */
  readonly standing?: "leaks" | "holds";
};

const sumOf = (values: readonly number[]): number =>
  values.reduce((sum, value) => sum + value, 0);

/**
 * The verdict of a report with `parts`, as the engine would carry it: the
 * judged and leaking territories are the parts with a `standing`, hottest
 * first; the level is `unknown` (too little evidence) unless `verdict` says
 * otherwise.
 */
const verdictOfParts = (
  parts: readonly PartSpec[],
  verdict: Partial<Analysis["verdict"]> = {},
): Analysis["verdict"] => {
  const judged = parts
    .filter(({ standing }) => standing !== undefined)
    .toSorted((one, other) => other.heat - one.heat);
  const leaking = judged.filter(({ standing }) => standing === "leaks");
  return {
    level: "unknown",
    reason: "too-little-evidence",
    leakShare: sumOf(leaking.map(({ heat }) => heat)),
    coverage: sumOf(judged.map(({ heat }) => heat)),
    judged: judged.map(({ id }) => id),
    leaking: leaking.map(({ id }) => id),
    eroding: false,
    trend: "unknown",
    ...verdict,
  };
};

/** The partner of a part that names none: a territory that is not in the report, so that it leaks somewhere. */
const REACHES_ELSEWHERE = {
  territory: "elsewhere",
  sharedChanges: 5,
  share: 0.25,
};

/**
 * A report whose territory tree is a root with the given parts as its
 * children, all visible at the one detail, which is the recommended one, and
 * whose verdict judged the parts with a `standing` (see `verdictOfParts`;
 * `verdict` in `overrides` replaces any of its fields).
 */
export const reportWithParts = (
  parts: readonly PartSpec[],
  {
    verdict,
    ...overrides
  }: Omit<Partial<Analysis>, "verdict"> & {
    readonly verdict?: Partial<Analysis["verdict"]>;
  } = {},
): Analysis => {
  const nodes = [
    territoryNode("root", ".", {
      children: parts.map(({ id }) => id),
      fit: null,
    }),
    ...parts.map(
      ({ id, path, heat, containment, kind, description, partner, changes }) =>
        territoryNode(id, path, {
          parent: "root",
          heatShare: heat,
          changes: changes ?? 20,
          kind: kind ?? "folder",
          description: description ?? `What ${path} is`,
          fit: territoryFit({
            containment,
            partner: partner === undefined ? REACHES_ELSEWHERE : partner,
          }),
        }),
    ),
  ];
  return reportOf(
    parts.map(({ id, path }) =>
      fileStats(`${path}/index.ts`, { territory: id }),
    ),
    [],
    [],
    {
      territories: {
        recommended: 1,
        details: [{ level: 1, ids: parts.map(({ id }) => id) }],
        nodes,
      },
      verdict: verdictOfParts(parts, verdict),
      ...overrides,
    },
  );
};

/** A boundary entry point of the given rank on the given territory ids. */
export const boundaryOn = (
  rank: number,
  territories: readonly string[],
): Analysis["entryPoints"][number] =>
  entryPointOf(rank, {
    territories,
    evidence: {
      containment: 0.35,
      distantPairs: 79,
      heatShare: 0.1,
      codeHeatShare: 0.12,
    },
    findings: [
      {
        kind: "boundary",
        verdict: "The boundary does not hold.",
        designMove: "Move a boundary: bring what changes together into one.",
        evidence: {
          containment: 0.35,
          distantPairs: 79,
          heatShare: 0.1,
          codeHeatShare: 0.12,
        },
        files: [],
        territories,
      },
    ],
  });
