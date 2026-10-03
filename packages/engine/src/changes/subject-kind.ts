// Owns what a commit subject says about a change: that it is a fix, or at
// least that its author follows a commit convention.

/** `fix`: the change corrects something; `convention`: its subject follows a commit convention but is no fix; `other`: neither. */
export type SubjectKind = "fix" | "convention" | "other";

/** `fix: …`, `fix(scope): …`, `hotfix!: …`, `bugfix: …`, `revert: …` (Conventional Commits). */
const FIX_TYPE = /^(fix|hotfix|bugfix|revert)(\(.+\))?!?:/iu;
/** Any other type of Conventional Commits, scope and breaking mark optional. */
const CONVENTIONAL_TYPE =
  /^(feat|docs|style|refactor|perf|tests?|build|ci|chore)(\(.+\))?!?:/iu;
/** What `git revert` writes. */
const REVERT = /^Revert "/u;
/** Words that, as the first word of a subject, say that the change fixes something (`Fix typo in …`, `Bug: …`). */
const FIX_WORDS: ReadonlySet<string> = new Set([
  "fix",
  "fixes",
  "fixed",
  "fixing",
  "bug",
  "bugfix",
  "hotfix",
]);
const FIRST_WORD = /^[a-z]+/iu;
/** `Bug 1234 - …`, `BUG-12: …`, `bug #7`: the word names a ticket, not a fix. */
const BUG_TICKET = /^bug[\s#-]*\d/iu;

const isFix = (subject: string): boolean =>
  FIX_TYPE.test(subject) ||
  REVERT.test(subject) ||
  (FIX_WORDS.has((FIRST_WORD.exec(subject)?.[0] ?? "").toLowerCase()) &&
    !BUG_TICKET.test(subject));

const kindOfSubject = (subject: string): SubjectKind => {
  if (isFix(subject)) {
    return "fix";
  }
  return CONVENTIONAL_TYPE.test(subject) ? "convention" : "other";
};

/**
 * What the `subjects` of the commits that make up one change say about it. A
 * change is a `fix` when more than half of its commits have a fix subject (a
 * pull request of a feature and its follow-up typo fix is a feature), and
 * follows a `convention` when more than half of them follow one, fixes
 * included.
 */
export const subjectKindOf = (subjects: ReadonlyArray<string>): SubjectKind => {
  const kinds = subjects.map((subject) => kindOfSubject(subject));
  const fixes = kinds.filter((kind) => kind === "fix").length;
  const conventional = kinds.filter((kind) => kind !== "other").length;
  if (fixes * 2 > kinds.length) {
    return "fix";
  }
  return conventional * 2 > kinds.length ? "convention" : "other";
};
