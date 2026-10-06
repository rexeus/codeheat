// Owns the repository verdict: whether the design holds up to the way the
// code changes, judged from the territories at the recommended detail and the
// erosion of the series.
import type { Erosion } from "../report/erosion.js";
import { roundReported } from "../report/precision.js";
import type { Report } from "../report/report.js";
import type { Territories, Territory } from "../report/territory.js";
import type { Verdict } from "../report/verdict.js";

/** Share of all the heat the judged territories must hold for the verdict to rest on evidence. */
export const MIN_VERDICT_COVERAGE = 0.5;
/** Share of all the heat in leaking territories from which the design holds only in parts. */
export const MIN_MIXED_LEAK_SHARE = 0.2;
/** Share of all the heat in leaking territories from which the design is under strain. */
export const MIN_STRAINED_LEAK_SHARE = 0.5;

/** The limits the verdict reads, as the report states them. */
type VerdictLimits = Pick<
  Report["thresholds"],
  | "minModuleCommits"
  | "maxEntryContainment"
  | "minVerdictCoverage"
  | "minMixedLeakShare"
  | "minStrainedLeakShare"
>;

type Level = Verdict["level"];

const isRealTerritory = ({ kind }: Territory): boolean =>
  kind === "package" || kind === "folder" || kind === "group";

/**
 * Whether a real territory leaks, holds, or cannot be judged. One with heat
 * but no counted change changed only in changes too large to count; one
 * below `minModuleCommits` has too few changes for its share to mean
 * anything; one that keeps little inside but has no partner says nothing
 * about where it leaks.
 */
const standingOf = (
  territory: Territory,
  limits: VerdictLimits,
): "leaks" | "holds" | "unjudged" => {
  const containment = territory.fit?.containment ?? null;
  if (
    (territory.changes === 0 && territory.heatShare > 0) ||
    containment === null ||
    territory.changes < limits.minModuleCommits
  ) {
    return "unjudged";
  }
  if (containment > limits.maxEntryContainment) {
    return "holds";
  }
  return (territory.fit?.partner ?? null) === null ? "unjudged" : "leaks";
};

/** The territories listed at the recommended detail, in the report's order. */
const recommendedOf = ({
  recommended,
  details,
  nodes,
}: Territories): ReadonlyArray<Territory> => {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const ids = details.find(({ level }) => level === recommended)?.ids ?? [];
  return ids.flatMap((id) => byId.get(id) ?? []);
};

const heatOf = (territories: ReadonlyArray<Territory>): number =>
  territories.reduce((sum, { heatShare }) => sum + heatShare, 0);

const baseLevel = (leakShare: number, limits: VerdictLimits): Level => {
  if (leakShare < limits.minMixedLeakShare) {
    return "holds";
  }
  return leakShare < limits.minStrainedLeakShare ? "mixed" : "strained";
};

/** A design that erodes is judged one level worse; one that improves is not judged better. */
const WORSE: Record<Level, Level> = {
  holds: "mixed",
  mixed: "strained",
  strained: "strained",
  unknown: "unknown",
};

const reasonOf = (
  territories: Territories,
  realCommits: number,
): Verdict["reason"] => {
  if (territories.nodes.length === 0) {
    return "no-territories";
  }
  return realCommits === 0 ? "quiet-window" : "too-little-evidence";
};

/**
 * Judges whether the design holds up to the way the code changes (see
 * `Verdict`). The shares are sums of the reported `heatShare` values of the
 * territories, compared as they are and rounded only for the report;
 * `realCommits` is `window.realCommits`.
 */
export const judgeVerdict = (input: {
  readonly territories: Territories;
  readonly erosion: Erosion | null;
  readonly realCommits: number;
  readonly limits: VerdictLimits;
}): Verdict => {
  const { territories, limits } = input;
  const judged = recommendedOf(territories)
    .filter((territory) => isRealTerritory(territory))
    .flatMap((territory) => {
      const standing = standingOf(territory, limits);
      return standing === "unjudged" ? [] : [{ territory, standing }];
    })
    .toSorted(
      (one, other) => other.territory.heatShare - one.territory.heatShare,
    );
  const leaking = judged.filter(({ standing }) => standing === "leaks");
  const leakShare = heatOf(leaking.map(({ territory }) => territory));
  const coverage = heatOf(judged.map(({ territory }) => territory));
  const eroding = input.erosion?.verdict === "eroding";
  const base =
    judged.length > 0 && coverage >= limits.minVerdictCoverage
      ? baseLevel(leakShare, limits)
      : "unknown";
  const level = eroding ? WORSE[base] : base;
  return {
    level,
    reason:
      level === "unknown" ? reasonOf(territories, input.realCommits) : null,
    leakShare: roundReported(Math.min(1, leakShare)),
    coverage: roundReported(Math.min(1, coverage)),
    judged: judged.map(({ territory }) => territory.id),
    leaking: leaking.map(({ territory }) => territory.id),
    eroding,
  };
};
