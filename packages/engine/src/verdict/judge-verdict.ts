// Owns the repository verdict: whether the design holds up to the way the
// code changes, judged from the territories at the recommended detail and how
// much of their changes they kept inside over the series.
import type { Analysis } from "../model/analysis.js";
import { roundReported } from "../model/precision.js";
import type { Territories, Territory } from "../model/territory.js";
import type { Verdict } from "../model/verdict.js";
import { judgeAreaTrend } from "./area-trend.js";

/** Share of all the heat the judged territories must hold for the verdict to rest on evidence. */
export const MIN_VERDICT_COVERAGE = 0.5;
/** Share of all the heat in leaking territories from which the design holds only in parts. */
export const MIN_MIXED_LEAK_SHARE = 0.2;
/** Share of all the heat in leaking territories from which the design is under strain. */
export const MIN_STRAINED_LEAK_SHARE = 0.5;

/** The limits the verdict reads, as the report states them. */
type VerdictLimits = Pick<
  Analysis["thresholds"],
  | "minModuleCommits"
  | "maxEntryContainment"
  | "minVerdictCoverage"
  | "minMixedLeakShare"
  | "minStrainedLeakShare"
  | "minWindowChanges"
  | "minVerdictWindows"
>;

type Level = Verdict["level"];

const isRealTerritory = ({ kind }: Territory): boolean =>
  kind === "package" || kind === "folder" || kind === "group";

/**
 * Whether a real territory leaks, holds, or cannot be judged. One below
 * `minModuleCommits` has too few changes for its share to mean anything;
 * one that keeps little inside but has no partner says nothing about where
 * it leaks.
 */
const standingOf = (
  territory: Territory,
  limits: VerdictLimits,
): "leaks" | "holds" | "unjudged" => {
  const containment = territory.fit?.containment ?? null;
  if (containment === null || territory.changes < limits.minModuleCommits) {
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

/** The share of all the heat `territories` hold, as the report carries it: at most 1, rounded. */
const reportedShare = (territories: ReadonlyArray<Territory>): number =>
  roundReported(
    Math.min(
      1,
      territories.reduce((sum, { heatShare }) => sum + heatShare, 0),
    ),
  );

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
 * territories, rounded as the report carries them, and the level is decided
 * on those rounded shares, so that the report never contradicts itself (a
 * `leakShare` of 0.2 is never `holds`); `realCommits` is `window.realCommits`.
 * `windows` holds, per window of the series, oldest first, the territories
 * at the recommended detail that each counted change touched, from which the
 * `trend` of the judged ones is read (see `judgeAreaTrend`).
 */
export const judgeVerdict = (input: {
  readonly territories: Territories;
  readonly windows: ReadonlyArray<ReadonlyArray<ReadonlySet<string>>>;
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
  const leakShare = reportedShare(leaking.map(({ territory }) => territory));
  const coverage = reportedShare(judged.map(({ territory }) => territory));
  const trend = judgeAreaTrend(
    new Set(judged.map(({ territory }) => territory.id)),
    input.windows,
    limits,
  );
  const eroding = trend === "eroding";
  const base =
    judged.length > 0 && coverage >= limits.minVerdictCoverage
      ? baseLevel(leakShare, limits)
      : "unknown";
  const level = eroding ? WORSE[base] : base;
  return {
    level,
    reason:
      level === "unknown" ? reasonOf(territories, input.realCommits) : null,
    leakShare,
    coverage,
    judged: judged.map(({ territory }) => territory.id),
    leaking: leaking.map(({ territory }) => territory.id),
    eroding,
    trend,
  };
};
