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
    "revert: bring back the cache",
    "Revert(api): bring back the cache",
    "Fix typo in the readme",
    "fixes the login redirect (#12)",
    "Fixed flaky test",
    "Bug: login redirect loops",
    "bug in the parser",
  ])("reads a revert or a first word that says fix: %j", (subject) => {
    expect(kindOf(subject)).toBe("fix");
  });
});

describe("subjectKindOf a scope and a fix word", () => {
  it.each([
    "compiler: fix crash on empty input",
    "core/router: fixed a leak",
    "ngcc: fixes the loop",
    "zone.js:fix patch of timers",
  ])(
    "reads a lowercase scope, a colon, and a fix word as a fix: %j",
    (subject) => {
      expect(kindOf(subject)).toBe("fix");
    },
  );

  it.each([
    ["cli: add a flag", "other"],
    ["cli: fixture update", "other"],
    ["Compiler: fix crash", "other"],
    ["feat: fix the layout of the table", "convention"],
    ["docs(api): fixes in the guide", "convention"],
  ] as const)("does not read %j as a fix", (subject, kind) => {
    expect(kindOf(subject)).toBe(kind);
  });

  it.each([
    "Bug 1234 - Add the export button",
    "Bug 1234: Stop the crash on startup",
    "BUG-12: handle null",
    "bug #7 crash on empty input",
    "Bug1234 - Rework the list",
  ])(
    "does not take bug followed by a ticket number, as a tracker names it, for a fix: %j",
    (subject) => {
      expect(kindOf(subject)).toBe("other");
    },
  );

  it.each([
    "bug: crash on empty input",
    "Bug in the export, see the ticket 1234",
    "bugfix 1234: crash on empty input",
  ])(
    "still reads bug as a fix word when no ticket number follows it: %j",
    (subject) => {
      expect(kindOf(subject)).toBe("fix");
    },
  );
});

describe("subjectKindOf a single commit that is no fix", () => {
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
