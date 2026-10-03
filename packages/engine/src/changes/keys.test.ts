import { describe, expect, it } from "vitest";

import { isPullRequestMerge, pullRequestOf, ticketOf } from "./keys.js";

describe("pullRequestOf", () => {
  it("reads the number a squash merge appends to the subject", () => {
    expect(pullRequestOf("fix(core): handle nulls (#1234)")).toBe("1234");
    expect(pullRequestOf("fix: x (#7)  ")).toBe("7");
  });

  it("ignores a number anywhere but at the end of the subject", () => {
    expect(pullRequestOf("fix: same as #12")).toBeUndefined();
    expect(pullRequestOf("fix (#12) and more")).toBeUndefined();
    expect(pullRequestOf("fix: x (#12a)")).toBeUndefined();
  });
});

describe("ticketOf", () => {
  it("finds a key at the start, in brackets, or after a prefix", () => {
    expect(ticketOf("PROJ-42 add it")).toBe("PROJ-42");
    expect(ticketOf("[PROJ-42] add it")).toBe("PROJ-42");
    expect(ticketOf("feat(api): PROJ-42: add it")).toBe("PROJ-42");
    expect(ticketOf("feat/AB2-7 add it")).toBe("AB2-7");
  });

  it("takes the first key of a subject", () => {
    expect(ticketOf("PROJ-1 and PROJ-2")).toBe("PROJ-1");
  });

  it("does not take a key out of a longer word or from lower case", () => {
    expect(ticketOf("xPROJ-42")).toBeUndefined();
    expect(ticketOf("PROJ-42x")).toBeUndefined();
    expect(ticketOf("proj-42")).toBeUndefined();
    expect(ticketOf("A-1")).toBeUndefined();
  });

  it("skips encodings, hashes, standards, and vulnerability ids", () => {
    expect(ticketOf("fix: UTF-8 handling")).toBeUndefined();
    expect(ticketOf("feat: SHA-256 digests")).toBeUndefined();
    expect(ticketOf("fix CVE-2024-1234")).toBeUndefined();
    expect(ticketOf("fix: UTF-8 in PROJ-5")).toBe("PROJ-5");
  });
});

describe("isPullRequestMerge", () => {
  it.each([
    ["GitHub", "Merge pull request #12 from org/feature"],
    ["Gitea", "Merge pull request 'Add it' (#12) from feature into main"],
    ["Bitbucket", "Merged in feature/x (pull request #12)"],
    [
      "GitLab",
      "Merge branch 'feature' into 'main'\n\nAdd it\n\nSee merge request group/project!12",
    ],
    ["Azure DevOps", "Merged PR 12: Add it"],
  ])("recognizes a %s merge", (_service, message) => {
    expect(isPullRequestMerge(message)).toBe(true);
  });

  it.each([
    "Merge branch 'main' of github.com:org/repo",
    "Merge remote-tracking branch 'origin/main'",
    "Merge tag 'v1.2.0'",
    "Merge branch 'feature'",
    "Merge branch 'main' into feature",
    "Merge branches 'a' and 'b'",
    "Merge branch 'x' into 'main'\n\nsee the merge request discussion",
  ])("does not take %j for a pull request merge", (message) => {
    expect(isPullRequestMerge(message)).toBe(false);
  });
});

describe("ticketOf stoplist", () => {
  it.each([
    "CWE-79 escape output",
    "run on X86-64",
    "GPL-3 licence header",
    "GPT-4 prompts",
    "BSD-3 licence",
    "ISO-8601 dates",
    "RFC-3339 timestamps",
    "MD-5 digests",
    "AES-256 keys",
    "TLS-1 removal",
    "HTTP-2 support",
  ])("skips the look-alike in %j", (subject) => {
    expect(ticketOf(subject)).toBeUndefined();
  });
});
