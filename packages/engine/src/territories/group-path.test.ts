import { describe, expect, it } from "vitest";

import { groupPath } from "./group-path.js";

describe("groupPath", () => {
  it("names sibling folders once with a brace glob over their directory", () => {
    expect(
      groupPath(["packages/engine/src/inspect", "packages/engine/src/report"]),
    ).toBe("packages/engine/src/{inspect,report}");
  });

  it("names folders at the repository root with a brace glob alone", () => {
    expect(groupPath(["apps", "packages", "tools"])).toBe(
      "{apps,packages,tools}",
    );
  });

  it("keeps the rest of a folder that branches deeper inside the braces", () => {
    expect(groupPath(["packages/a/src", "packages/b"])).toBe(
      "packages/{a/src,b}",
    );
  });

  it("escapes the characters of a brace glob in the members' names", () => {
    expect(groupPath(["a/x,y", "a/z"])).toBe(String.raw`a/{x\,y,z}`);
    expect(groupPath(["a/{b}", String.raw`a/c\d`])).toBe(
      String.raw`a/{\{b\},c\\d}`,
    );
  });

  it("writes the shared directory as it is", () => {
    expect(
      groupPath(["{{cookiecutter.slug}}/api", "{{cookiecutter.slug}}/web"]),
    ).toBe("{{cookiecutter.slug}}/{api,web}");
  });
});
