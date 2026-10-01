import { describe, expect, it } from "vitest";

import { createResolver } from "./resolve.js";
import type { WorkspacePackage } from "./resolve.js";

const resolverFor = (
  files: ReadonlyArray<string>,
  packages: Record<string, WorkspacePackage> = {},
) => createResolver(new Set(files), new Map(Object.entries(packages)));

describe("relative specifiers with extensions", () => {
  it("adds the extension that exists, TypeScript before JavaScript", () => {
    const resolve = resolverFor([
      "src/util.js",
      "src/util.ts",
      "src/view.tsx",
      "src/old.js",
    ]);

    expect(resolve("src/main.ts", "./util")).toStrictEqual(["src/util.ts"]);
    expect(resolve("src/main.ts", "./view")).toStrictEqual(["src/view.tsx"]);
    expect(resolve("src/main.ts", "./old")).toStrictEqual(["src/old.js"]);
  });

  it("maps a .js specifier to the .ts source as TypeScript does", () => {
    const resolve = resolverFor([
      "src/util.ts",
      "src/view.tsx",
      "src/esm.mts",
      "src/cjs.cts",
      "src/types.d.ts",
    ]);

    expect(resolve("src/main.ts", "./util.js")).toStrictEqual(["src/util.ts"]);
    expect(resolve("src/main.ts", "./view.jsx")).toStrictEqual([
      "src/view.tsx",
    ]);
    expect(resolve("src/main.ts", "./view.js")).toStrictEqual(["src/view.tsx"]);
    expect(resolve("src/main.ts", "./esm.mjs")).toStrictEqual(["src/esm.mts"]);
    expect(resolve("src/main.ts", "./cjs.cjs")).toStrictEqual(["src/cjs.cts"]);
    expect(resolve("src/main.ts", "./types.js")).toStrictEqual([
      "src/types.d.ts",
    ]);
  });

  it("keeps a real .js file when no source with that name exists", () => {
    const resolve = resolverFor(["src/legacy.js"]);

    expect(resolve("src/main.ts", "./legacy.js")).toStrictEqual([
      "src/legacy.js",
    ]);
  });
});

describe("relative specifiers with directories", () => {
  it("falls back to the index file of a directory", () => {
    const resolve = resolverFor([
      "src/feature/index.ts",
      "src/plain/index.js",
      "src/both.ts",
      "src/both/index.ts",
    ]);

    expect(resolve("src/main.ts", "./feature")).toStrictEqual([
      "src/feature/index.ts",
    ]);
    expect(resolve("src/main.ts", "./plain/")).toStrictEqual([
      "src/plain/index.js",
    ]);
    expect(resolve("src/main.ts", "./both")).toStrictEqual(["src/both.ts"]);
  });

  it("resolves parent directories and the importing directory itself", () => {
    const resolve = resolverFor(["lib/shared.ts", "src/deep/index.ts"]);

    expect(resolve("src/deep/inner/x.ts", "../../../lib/shared")).toStrictEqual(
      ["lib/shared.ts"],
    );
    expect(resolve("src/deep/x.ts", ".")).toStrictEqual(["src/deep/index.ts"]);
    expect(resolve("src/deep/x.ts", "./../deep/./index")).toStrictEqual([
      "src/deep/index.ts",
    ]);
  });

  it("resolves from the repository root", () => {
    const resolve = resolverFor(["config.ts", "src/a.ts"]);

    expect(resolve("main.ts", "./config")).toStrictEqual(["config.ts"]);
    expect(resolve("main.ts", "./src/a")).toStrictEqual(["src/a.ts"]);
  });

  it("resolves nothing that leaves the repository or the universe", () => {
    const resolve = resolverFor(["src/a.ts"]);

    expect(resolve("src/main.ts", "../../outside")).toStrictEqual([]);
    expect(resolve("src/main.ts", "./data.json")).toStrictEqual([]);
    expect(resolve("src/main.ts", "./missing")).toStrictEqual([]);
  });
});

describe("package specifiers", () => {
  const packages = {
    "@acme/core": {
      directory: "packages/core",
      entryPoints: ["packages/core/src/index.ts", "packages/core/src/web.ts"],
    },
    shared: { directory: "libs/shared", entryPoints: ["libs/shared/main.ts"] },
  };
  const files = [
    "packages/core/src/index.ts",
    "packages/core/src/web.ts",
    "packages/core/src/errors.ts",
    "packages/core/testing/index.ts",
    "libs/shared/main.ts",
    "libs/shared/util.ts",
  ];

  it("resolves a workspace package name to its entry points", () => {
    const resolve = resolverFor(files, packages);

    expect(resolve("apps/cli/src/a.ts", "@acme/core")).toStrictEqual([
      "packages/core/src/index.ts",
      "packages/core/src/web.ts",
    ]);
    expect(resolve("apps/cli/src/a.ts", "shared")).toStrictEqual([
      "libs/shared/main.ts",
    ]);
  });

  it("resolves a subpath below the package directory or its src", () => {
    const resolve = resolverFor(files, packages);

    expect(resolve("apps/a.ts", "@acme/core/testing")).toStrictEqual([
      "packages/core/testing/index.ts",
    ]);
    expect(resolve("apps/a.ts", "@acme/core/errors")).toStrictEqual([
      "packages/core/src/errors.ts",
    ]);
    expect(resolve("apps/a.ts", "shared/util.js")).toStrictEqual([
      "libs/shared/util.ts",
    ]);
  });

  it("ignores packages that are not in the workspace and Node built-ins", () => {
    const resolve = resolverFor(files, packages);

    expect(resolve("apps/a.ts", "react")).toStrictEqual([]);
    expect(resolve("apps/a.ts", "@acme/other")).toStrictEqual([]);
    expect(resolve("apps/a.ts", "node:path")).toStrictEqual([]);
    expect(resolve("apps/a.ts", "@acme/core/missing")).toStrictEqual([]);
  });
});
