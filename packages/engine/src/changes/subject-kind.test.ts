import { describe, expect, it } from "vitest";

import { subjectKindOf } from "./subject-kind.js";

const kindOf = (subject: string) => subjectKindOf([subject]);

describe("subjectKindOf a single commit", () => {
  it.each([
    "fix: crash on empty input",
    "fix(api): crash on empty input",
    "fix!: drop the old format",
    "Fix(api)!: drop the old format",
    "hotfix: roll back the limit",
    "bugfix(core): off by one",
  ])("reads the Conventional Commits fix type of %j", (subject) => {
    expect(kindOf(subject)).toBe("fix");
  });

  it.each([
    'Revert "feat: add the cache"',
    "Fix typo in the readme",
    "fixes the login redirect (#12)",
    "Fixed flaky test",
    "Bug: login redirect loops",
    "bug in the parser",
  ])("reads a revert or a first word that says fix: %j", (subject) => {
    expect(kindOf(subject)).toBe("fix");
  });

  it.each([
    "feat: add the cache",
    "chore(deps): bump vitest",
    "docs!: rewrite the guide",
    "refactor(api): split the router",
    "test: cover the parser",
    "build: pin node",
  ])(
    "calls another Conventional Commits type a convention, not a fix: %j",
    (subject) => {
      expect(kindOf(subject)).toBe("convention");
    },
  );

  it.each([
    "Add the cache",
    "Update README",
    "wip",
    "fixture: new sample",
    "prefix handling",
    "Note: this is not a type",
    "",
  ])("sees nothing in free text: %j", (subject) => {
    expect(kindOf(subject)).toBe("other");
  });
});

describe("subjectKindOf the commits of one change", () => {
  it("is a fix when more than half of the commits fix something", () => {
    expect(subjectKindOf(["fix: a", "fix: b", "feat: c"])).toBe("fix");
  });

  it("is no fix when a feature has a follow-up fix of its own", () => {
    expect(subjectKindOf(["feat: a", "fix: typo", "feat: b"])).toBe(
      "convention",
    );
    expect(subjectKindOf(["feat: a", "fix: typo"])).toBe("convention");
  });

  it("follows a convention only when more than half of the commits do", () => {
    expect(subjectKindOf(["feat: a", "wip", "wip"])).toBe("other");
    expect(subjectKindOf(["feat: a", "chore: b", "wip"])).toBe("convention");
  });

  it("sees nothing in no commits", () => {
    expect(subjectKindOf([])).toBe("other");
  });
});
