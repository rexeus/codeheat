import { describe, expect, it } from "vitest";

import { territoryNode } from "../testing/reports.js";
import { distinctNameParts } from "./distinct-names.js";

describe("distinctNameParts", () => {
  it("leaves names that do not collide as they are split", () => {
    const docs = territoryNode("t1", "packages/docs");
    const core = territoryNode("t2", "packages/core");

    const partsOf = distinctNameParts([docs, core]);

    expect(partsOf(docs)).toEqual({ dir: "packages/", base: "docs" });
    expect(partsOf(core)).toEqual({ dir: "packages/", base: "core" });
  });

  it("puts the parent folder in front of a name that two territories share", () => {
    const rootScripts = territoryNode("t1", "scripts");
    const adevScripts = territoryNode("t2", "adev/scripts");

    const partsOf = distinctNameParts([rootScripts, adevScripts]);

    expect(partsOf(rootScripts)).toEqual({ dir: "", base: "scripts" });
    expect(partsOf(adevScripts)).toEqual({ dir: "", base: "adev/scripts" });
  });

  it("keeps the folders above the distinguishing one dimmed", () => {
    const first = territoryNode("t1", "apps/web/src/scripts");
    const second = territoryNode("t2", "apps/api/src/scripts");
    const other = territoryNode("t3", "apps/web/src/lib");

    const partsOf = distinctNameParts([first, second, other]);

    expect(partsOf(first)).toEqual({ dir: "apps/", base: "web/src/scripts" });
    expect(partsOf(second)).toEqual({ dir: "apps/", base: "api/src/scripts" });
    expect(partsOf(other)).toEqual({ dir: "apps/web/src/", base: "lib" });
  });

  it("adds only as many folders as it takes to tell the territories apart", () => {
    const first = territoryNode("t1", "a/x/scripts");
    const second = territoryNode("t2", "b/y/scripts");

    const partsOf = distinctNameParts([first, second]);

    expect(partsOf(first)).toEqual({ dir: "a/", base: "x/scripts" });
    expect(partsOf(second)).toEqual({ dir: "b/", base: "y/scripts" });
  });

  it("qualifies every member of a collision and leaves an unrelated name alone", () => {
    const folder = territoryNode("t1", "lib/util");
    const other = territoryNode("t2", "app/util");
    const alone = territoryNode("t3", "app/core");

    const partsOf = distinctNameParts([folder, other, alone]);

    expect(partsOf(folder).base).toBe("lib/util");
    expect(partsOf(other).base).toBe("app/util");
    expect(partsOf(alone).base).toBe("core");
  });

  it("only compares the territories it is given", () => {
    const rootScripts = territoryNode("t1", "scripts");
    const adevScripts = territoryNode("t2", "adev/scripts");

    const partsOf = distinctNameParts([adevScripts]);

    expect(partsOf(adevScripts)).toEqual({ dir: "adev/", base: "scripts" });
    expect(partsOf(rootScripts)).toEqual({ dir: "", base: "scripts" });
  });
});
