import { describe, expect, it } from "vitest";

import type { ModuleRef } from "../modules/detect.js";
import { contractHomes } from "./homes.js";

const pkg = (path: string): ModuleRef => ({ path, kind: "package" });
const directory = (path: string): ModuleRef => ({ path, kind: "directory" });

describe("contractHomes", () => {
  it("houses a contract in the nearest module above it", () => {
    const modules = new Map([
      ["packages/a/src/x.ts", pkg("packages/a")],
      ["packages/a/nested/y.ts", pkg("packages/a/nested")],
      ["packages/b/src/z.ts", pkg("packages/b")],
    ]);

    const homes = contractHomes(
      [
        "packages/a/api/main.tsp",
        "packages/a/nested/deep/api.proto",
        "packages/b/openapi.yaml",
      ],
      modules,
    );

    expect([...homes].map(([file, { path }]) => [file, path])).toStrictEqual([
      ["packages/a/api/main.tsp", "packages/a"],
      ["packages/a/nested/deep/api.proto", "packages/a/nested"],
      ["packages/b/openapi.yaml", "packages/b"],
    ]);
  });

  it("houses a contract above every module at the root", () => {
    const modules = new Map([["src/x.ts", directory("src")]]);

    const homes = contractHomes(["specs/api.graphql", "api.tsp"], modules);

    expect([...homes.values()]).toStrictEqual([directory("."), directory(".")]);
  });
});
