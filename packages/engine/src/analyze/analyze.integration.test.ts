import { describe, it } from "@effect/vitest";

describe("analyze", () => {
  it.todo("ranks files by revisions times indentation complexity");
  it.todo("reports a pair that changes together in enough commits as coupled");
  it.todo(
    "ignores commits above maxCommitFiles for coupling but counts their revisions",
  );
  it.todo("counts revisions of a renamed file under its current path");
  it.todo("resolves since against the clock and reports the window bounds");
  it.todo("limits the universe to files under the given path");
  it.todo(
    "excludes ignored, linguist-generated, linguist-vendored, binary, and minified files",
  );
  it.todo(
    "replaces the language allow-list with include globs and then applies exclude globs",
  );
  it.todo("reports a null head for a repository without commits");
  it.todo("fails with NotAGitRepository outside a git work tree");
  it.todo("fails with GitNotFound when git is not on PATH");
  it.todo("fails with InvalidSince for an unparseable since value");
});
