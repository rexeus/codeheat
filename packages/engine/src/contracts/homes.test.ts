import { describe, expect, it } from "vitest";

import type { ModuleRef } from "../modules/detect.js";
import { contractHomes } from "./homes.js";

const pkg = (path: string): ModuleRef => ({ path, kind: "package" });
const directory = (path: string): ModuleRef => ({ path, kind: "directory" });

const pathsOf = (homes: ReadonlyMap<string, ModuleRef>) =>
  [...homes].map(([file, { path }]) => [file, path]);

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

    expect(pathsOf(homes)).toStrictEqual([
      ["packages/a/api/main.tsp", "packages/a"],
      ["packages/a/nested/deep/api.proto", "packages/a/nested"],
      ["packages/b/openapi.yaml", "packages/b"],
    ]);
  });

  it("houses a contract beside the modules in the highest directory above it that holds no code", () => {
    const modules = new Map([
      ["apps/x/backend/a.ts", directory("apps/x/backend")],
      ["apps/x/infra/b.ts", directory("apps/x/infra")],
    ]);

    const homes = contractHomes(
      [
        "apps/x/spec/lib/orders/get.tsp",
        "apps/x/spec/main.tsp",
        "specs/api.graphql",
        "api.tsp",
      ],
      modules,
    );

    expect(pathsOf(homes)).toStrictEqual([
      ["apps/x/spec/lib/orders/get.tsp", "apps/x/spec"],
      ["apps/x/spec/main.tsp", "apps/x/spec"],
      ["specs/api.graphql", "specs"],
      ["api.tsp", "."],
    ]);
  });

  it("houses a contract in its own directory when code lies below every directory above it", () => {
    const modules = new Map([
      ["spec/gen/a.ts", directory("spec/gen")],
      ["src/b.ts", directory("src")],
    ]);

    const homes = contractHomes(["spec/api.graphql"], modules);

    expect(pathsOf(homes)).toStrictEqual([["spec/api.graphql", "spec"]]);
  });
});
