import { describe, expect, it } from "vitest";

import { dependentsByFile } from "./dependencies.js";

describe("dependentsByFile", () => {
  it("lists for each file the files that load it directly", () => {
    const dependents = dependentsByFile(
      new Map([
        ["a.ts", new Set(["shared.ts", "b.ts"])],
        ["b.ts", new Set(["shared.ts"])],
        ["shared.ts", new Set<string>()],
      ]),
    );

    expect([...(dependents.get("shared.ts") ?? [])]).toEqual(["a.ts", "b.ts"]);
    expect([...(dependents.get("b.ts") ?? [])]).toEqual(["a.ts"]);
    expect(dependents.has("a.ts")).toBe(false);
  });

  it("does not count a file that loads itself", () => {
    const dependents = dependentsByFile(new Map([["a.ts", new Set(["a.ts"])]]));

    expect(dependents.size).toBe(0);
  });

  it("does not follow a re-export: a file that loads a barrel depends on the barrel only", () => {
    const dependents = dependentsByFile(
      new Map([
        ["app.ts", new Set(["index.ts"])],
        ["index.ts", new Set(["impl.ts"])],
      ]),
    );

    expect([...(dependents.get("index.ts") ?? [])]).toEqual(["app.ts"]);
    expect([...(dependents.get("impl.ts") ?? [])]).toEqual(["index.ts"]);
  });
});
