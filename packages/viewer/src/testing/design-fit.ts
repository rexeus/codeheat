import type { Report } from "@codeheat/engine";

import {
  entryPointOf,
  fileStats,
  reportOf,
  territoryFit,
  territoryNode,
} from "./reports.js";

type Territory = Report["territories"]["nodes"][number];

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
};

/** The partner of a part that names none: a territory that is not in the report, so that it leaks somewhere. */
const REACHES_ELSEWHERE = {
  territory: "elsewhere",
  sharedChanges: 5,
  share: 0.25,
};

/**
 * A report whose territory tree is a root with the given parts as its
 * children, all visible at the one detail, which is the recommended one.
 */
export const reportWithParts = (
  parts: readonly PartSpec[],
  overrides: Partial<Report> = {},
): Report => {
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
      ...overrides,
    },
  );
};

/** A boundary entry point of the given rank on the given territory ids. */
export const boundaryOn = (
  rank: number,
  territories: readonly string[],
): Report["entryPoints"][number] =>
  entryPointOf(rank, {
    territories,
    evidence: { containment: 0.35, distantPairs: 79, heatShare: 0.1 },
    findings: [
      {
        kind: "boundary",
        verdict: "The boundary does not hold.",
        designMove: "Move a boundary: bring what changes together into one.",
        evidence: { containment: 0.35, distantPairs: 79, heatShare: 0.1 },
        files: [],
        territories,
      },
    ],
  });

/** An erosion of the given verdict over `windows` quarters, whose locality falls from 80 % to 60 %. */
export const erosionOf = (
  verdict: "eroding" | "improving" | "holding" | "unknown",
  windows = 8,
): NonNullable<Report["erosion"]> => ({
  verdict,
  inactiveSince: null,
  windows,
  locality: { from: 0.8, to: 0.6, slope: -0.02 },
  propagationCost: null,
});
