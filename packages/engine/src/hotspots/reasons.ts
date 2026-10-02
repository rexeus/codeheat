// Owns the explanations attached to a scored file, for humans and agents alike.
import type { Partner } from "../coupling/partners.js";
import { isTestPath } from "../modules/test-path.js";

/** Fewest distinct co-changed files that make a file a hub. */
export const HUB_MIN_BREADTH = 10;
/** Fewest revisions a file needs to be a hub candidate, so one big commit cannot make a hub. */
export const HUB_MIN_REVISIONS = 5;
/** Share of the hub candidates, widest first, that may be hubs; ties at the cut-off are included. */
export const HUB_TOP_SHARE = 0.05;

/** Smallest co-change probability at which a partner without an import gets a reason line. */
export const MIN_HIDDEN_PROBABILITY = 0.5;

/** Only frequently changed files that are not test code (`isTestPath`) can be hubs and are ranked by breadth. */
export const isHubCandidate = (path: string, revisions: number): boolean =>
  revisions >= HUB_MIN_REVISIONS && !isTestPath(path);

export type ReasonFacts = {
  readonly revisions: number;
  /** 1 for the most revised file; equal revisions share a rank. */
  readonly revisionRank: number;
  readonly complexity: number;
  readonly complexityRank: number;
  /** Universe size. */
  readonly of: number;
  readonly partners: ReadonlyArray<Partner>;
  /** Distinct other files changed together with this one. */
  readonly breadth: number;
  /**
   * 1 for the widest hub candidate; equal breadths share a rank. Undefined
   * for a file that is not a candidate (see `isHubCandidate`).
   */
  readonly breadthRank: number | undefined;
  /** How many files are hub candidates. */
  readonly candidates: number;
  /**
   * For an entry point of a module whose interface leaks, the share of the
   * module's implementation commits that also touched an entry point.
   */
  readonly interfaceLeakage: number | undefined;
};

/** A wide candidate among the widest `HUB_TOP_SHARE` of the candidates, at least one; ties at the cut-off all count. */
const isHub = (facts: ReasonFacts): boolean =>
  facts.breadthRank !== undefined &&
  facts.breadth >= HUB_MIN_BREADTH &&
  facts.breadthRank <= Math.ceil(facts.candidates * HUB_TOP_SHARE);

const percentOf = (probability: number): number =>
  Math.round(probability * 100);

/** The reason for the strongest non-test partner: a hidden coupling when no import links it and it is likely enough. */
const describePartner = (
  partners: ReadonlyArray<Partner>,
): ReadonlyArray<string> => {
  const strongest = partners.find(({ testPair }) => !testPair);
  if (strongest === undefined) {
    return [];
  }
  const percent = percentOf(strongest.probability);
  const isHidden =
    strongest.imports === "none" &&
    strongest.probability >= MIN_HIDDEN_PROBABILITY;
  return [
    isHidden
      ? `changes with ${strongest.path} in ${percent}% of its commits without an import between them`
      : `co-changes with ${strongest.path} in ${percent}% of its commits`,
  ];
};

/**
 * Reasons in a fixed order: churn, complexity, then the strongest non-test
 * co-change partner (worded as hidden coupling when no import links it and its
 * probability is at least `MIN_HIDDEN_PROBABILITY`), then the breadth of a hub,
 * then a leaking interface. A signal at zero gives no reason.
 */
export const describeFile = (facts: ReasonFacts): ReadonlyArray<string> => {
  const reasons: Array<string> = [];
  if (facts.revisions > 0) {
    const commits = facts.revisions === 1 ? "commit" : "commits";
    reasons.push(
      `changed in ${facts.revisions} ${commits} (#${facts.revisionRank} of ${facts.of})`,
    );
  }
  if (facts.complexity > 0) {
    reasons.push(
      `indentation complexity ${facts.complexity} (#${facts.complexityRank} of ${facts.of})`,
    );
  }
  reasons.push(...describePartner(facts.partners));
  if (isHub(facts)) {
    reasons.push(`changes together with ${facts.breadth} different files`);
  }
  if (facts.interfaceLeakage !== undefined) {
    reasons.push(
      `interface changed in ${percentOf(facts.interfaceLeakage)}% of its module's implementation commits`,
    );
  }
  return reasons;
};
