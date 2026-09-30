// Owns the explanations attached to a scored file, for humans and agents alike.
import type { Partner } from "../coupling/partners.js";

export type ReasonFacts = {
  readonly revisions: number;
  /** 1 for the most revised file; equal revisions share a rank. */
  readonly revisionRank: number;
  readonly complexity: number;
  readonly complexityRank: number;
  /** Universe size. */
  readonly of: number;
  readonly partners: ReadonlyArray<Partner>;
};

/**
 * Reasons in a fixed order: churn, complexity, then the strongest non-test
 * co-change partner. A signal at zero gives no reason.
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
  return reasons;
};
