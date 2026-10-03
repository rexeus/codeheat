// Owns what a commit message says about the change it belongs to: the pull
// request a squash merge or a merge commit names and the ticket a subject
// mentions.

/** The `(#123)` that GitHub and GitLab append to a squash-merged subject. */
const PULL_REQUEST = /\(#(\d+)\)\s*$/u;

/**
 * What a pull or merge request merge says about itself, anywhere in its
 * message: GitHub (`Merge pull request #12 from …`, Gitea's `Merge pull
 * request 'title' (#12) from …`), Bitbucket Cloud (`Merged in … (pull request
 * #12)`), Bitbucket Server and Data Center (`Pull request #12: …`, `Merge pull
 * request #12 in PROJ/repo from …`), GitLab (the body line `See merge request
 * group/project!12`), and Azure DevOps (`Merged PR 12: …`).
 */
const PULL_REQUEST_MERGES = [
  /^Merge pull request (?:#\d+ |.* \(#\d+\) )from /mu,
  /^Merge pull request #\d+ in \S+ from /mu,
  /^Pull request #\d+: /mu,
  /^Merged in .* \(pull request #\d+\)/mu,
  /^See merge request \S*!\d+/mu,
  /^Merged PR \d+:/mu,
] as const;

/**
 * Where a pull request merge names the branch it merged, in the order of the
 * formats above: GitHub (`from owner/branch`), Gitea (`from branch into …`),
 * Bitbucket Cloud (`Merged in branch (pull request …)`), Bitbucket Server
 * (`in PROJ/repo from branch to …`), and GitLab (`Merge branch 'branch' into …`).
 */
const MERGED_BRANCHES = [
  /^Merge pull request #\d+ from [^/\s]+\/(\S+)/mu,
  /^Merge pull request '.*' \(#\d+\) from (\S+) into /mu,
  /^Merged in (\S+) \(pull request #/mu,
  /^Merge (?:pull request #\d+ )?in \S+ from (\S+) to /mu,
  /^Merge branch '([^']+)' into /mu,
] as const;

/** A release or development branch that collects other work before it is merged on. */
const INTEGRATION_BRANCH =
  /^(?:(?:main|master|trunk|develop|development|dev|staging|stable|next|integration)|(?:releases?|stable)(?:[/_-].*)?)$/iu;

/** Subjects that a squash merge of a pull request gives its commit besides the `(#123)` suffix. */
const SQUASHED_SUBJECTS = [/^Merged PR \d+:/u, /^Pull request #\d+:/u] as const;

/**
 * Upper-case words that look like a ticket key (`UTF-8`, `SHA-256`, `X86-64`,
 * `CVE-2021-1234`) but name an encoding, a hash, a standard, an architecture,
 * a licence, or a vulnerability id.
 */
const NOT_TICKET_PROJECTS: ReadonlySet<string> = new Set([
  "AES",
  "BSD",
  "CVE",
  "CWE",
  "ECMA",
  "ES",
  "GHSA",
  "GPL",
  "GPT",
  "HTTP",
  "HTTPS",
  "IE",
  "IEC",
  "IEEE",
  "IPV",
  "ISO",
  "LGPL",
  "MD",
  "MIT",
  "PEP",
  "RFC",
  "RSA",
  "SHA",
  "SSH",
  "SSL",
  "TCP",
  "TLS",
  "UCS",
  "UDP",
  "UTF",
  "WCAG",
  "X64",
  "X86",
]);

const TICKET = /(?<![A-Za-z0-9])([A-Z][A-Z0-9]+)-\d+(?![A-Za-z0-9])/gu;

/** The number of the pull request a subject ends with, such as `123` for `fix: x (#123)`. */
export const pullRequestOf = (subject: string): string | undefined =>
  PULL_REQUEST.exec(subject)?.[1];

/**
 * Whether the subject of a commit that is no merge says a squash merge of a
 * pull request made it: a `(#123)` suffix, `Merged PR 12: …` (Azure DevOps), or
 * `Pull request #12: …` (Bitbucket Server).
 */
export const isSquashedPullRequest = (subject: string): boolean =>
  PULL_REQUEST.test(subject) ||
  SQUASHED_SUBJECTS.some((pattern) => pattern.test(subject));

/**
 * What a merge commit's message says about the pull or merge request it
 * merged: a `branch` for a feature, an `integration` branch (a release or
 * `develop` branch) whose commits belong to no one change, or nothing when it
 * names none. A merge that does not (`git pull`, `Merge remote-tracking
 * branch`, `Merge tag`, a plain `Merge branch 'x'`, a merge of the mainline
 * into a branch) brings in commits that belong to no one change.
 */
export const pullRequestMergeKind = (
  message: string,
): "branch" | "integration" | undefined => {
  if (!PULL_REQUEST_MERGES.some((pattern) => pattern.test(message))) {
    return undefined;
  }
  const branch = MERGED_BRANCHES.map(
    (pattern) => pattern.exec(message)?.[1],
  ).find((name) => name !== undefined);
  return branch !== undefined && INTEGRATION_BRANCH.test(branch)
    ? "integration"
    : "branch";
};

/** The first ticket key a subject mentions, such as `PROJ-42`; none for words like `UTF-8`. */
export const ticketOf = (subject: string): string | undefined =>
  Array.from(subject.matchAll(TICKET)).find(
    ([, project = ""]) => !NOT_TICKET_PROJECTS.has(project),
  )?.[0];
