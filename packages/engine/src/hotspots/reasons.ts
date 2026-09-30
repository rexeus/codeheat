// Owns the explanations attached to a scored file, for humans and agents alike.
import type { Partner } from "../coupling/partners.js";

/** Fewest distinct co-changed files that make a file a hub. */
export const HUB_MIN_BREADTH = 10;
/** Share of the universe, widest first, that may be hubs. */
export const HUB_TOP_SHARE = 0.05;

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
  /** 1 for the widest file; equal breadths share a rank. */
  readonly breadthRank: number;
};

/** Wide enough and among the widest `HUB_TOP_SHARE` of the universe, at least one file. */
const isHub = (facts: ReasonFacts): boolean =>
  facts.breadth >= HUB_MIN_BREADTH &&
  facts.breadthRank <= Math.ceil(facts.of * HUB_TOP_SHARE);

/**
 * Reasons in a fixed order: churn, complexity, then the strongest non-test
 * co-change partner, then the breadth of a hub. A signal at zero gives no reason.
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
  const partner = facts.partners.find(({ testPair }) => !testPair);
  if (partner !== undefined) {
    const percent = Math.round(partner.probability * 100);
    reasons.push(
      `co-changes with ${partner.path} in ${percent}% of its commits`,
    );
  }
  if (isHub(facts)) {
    reasons.push(`changes together with ${facts.breadth} different files`);
  }
  return reasons;
};
