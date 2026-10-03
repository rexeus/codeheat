// Owns what a commit message says about the change it belongs to: the pull
// request a squash merge names and the ticket a subject mentions.

/** The `(#123)` that GitHub and GitLab append to a squash-merged subject. */
const PULL_REQUEST = /\(#(\d+)\)\s*$/u;

/**
 * Upper-case words that look like a ticket key but are not: encodings,
 * hashes, standards, and vulnerability ids (`UTF-8`, `SHA-256`, `CVE-2021`).
 */
const NOT_TICKET_PROJECTS: ReadonlySet<string> = new Set([
  "AES",
  "CVE",
  "ECMA",
  "ES",
  "GHSA",
  "HTTP",
  "IE",
  "IPV",
  "ISO",
  "MD",
  "PEP",
  "RFC",
  "RSA",
  "SHA",
  "SSL",
  "TCP",
  "TLS",
  "UDP",
  "UTF",
  "WCAG",
]);

const TICKET = /(?<![A-Za-z0-9])([A-Z][A-Z0-9]+)-\d+(?![A-Za-z0-9])/gu;

/** The number of the pull request a subject ends with, such as `123` for `fix: x (#123)`. */
export const pullRequestOf = (subject: string): string | undefined =>
  PULL_REQUEST.exec(subject)?.[1];

/** The first ticket key a subject mentions, such as `PROJ-42`; none for words like `UTF-8`. */
export const ticketOf = (subject: string): string | undefined =>
  Array.from(subject.matchAll(TICKET)).find(
    ([, project = ""]) => !NOT_TICKET_PROJECTS.has(project),
  )?.[0];
